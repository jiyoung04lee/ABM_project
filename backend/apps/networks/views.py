from rest_framework import status
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.permissions import (
    IsAuthenticatedOrReadOnly,
    IsAuthenticated,
    IsAdminUser,
    AllowAny,
)

from .models import Category
from .serializers import CategorySerializer

from rest_framework.response import Response
from rest_framework.decorators import action

from django.db import models
from django.db.models import Q, Exists, OuterRef, F
from django.utils import timezone
from django.http import Http404
from django.core.cache import cache

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema

from .models import Post, Comment, Reaction, CommentReaction, Category
from .serializers import (
    PostListSerializer,
    PostDetailSerializer,
    PostCreateSerializer,
    CommentSerializer,
    CategorySerializer,
)
from .permissions import IsAuthorOrReadOnly

class CategoryViewSet(ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    queryset = Category.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        t = self.request.query_params.get("type")  # student/graduate/qa
        if t:
            qs = qs.filter(type=t)
        return qs

class PostViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Post.objects.filter(is_deleted=False)

        user = getattr(getattr(self, "request", None), "user", None)

        queryset = (
            Post.objects
            .filter(is_deleted=False)
            .select_related("author", "category")
            .prefetch_related("files")
        )

        # 로그인 사용자 기준 좋아요 여부 annotation
        if user and user.is_authenticated:
            user_reactions = Reaction.objects.filter(
                post=OuterRef("pk"),
                user=user
            )
            queryset = queryset.annotate(is_liked=Exists(user_reactions))
        else:
            queryset = queryset.annotate(
                is_liked=models.Value(False, output_field=models.BooleanField())
            )

        # ✅ 탭 필터: type=student|graduate|qa
        post_type = self.request.query_params.get("type")
        if post_type:
            queryset = queryset.filter(type=post_type)

        # ✅ 카테고리 필터: category=slug
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)

        # ✅ 탭 + 카테고리 섞임 방지 (중요)
        # 예: type=student인데 category.type=graduate인 글이 섞이는 것 방지
        if post_type:
            queryset = queryset.filter(category__type=post_type)

        # ✅ 검색: search=키워드 (title/content)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search)
            )

        # ✅ 정렬
        ordering = self.request.query_params.get("ordering")
        if ordering == "likes":
            queryset = queryset.order_by("-is_pinned", "-pinned_at", "-like_count")
        else:
            queryset = queryset.order_by("-is_pinned", "-pinned_at", "-created_at")

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return PostListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return PostCreateSerializer
        return PostDetailSerializer

    # (선택) 작성 시 type을 query 기준으로 강제하고 싶으면 사용
    # 지금은 serializer가 body로 type을 받으니 필요 없으면 지워도 됨.
    # def perform_create(self, serializer):
    #     post_type = self.request.query_params.get("type")
    #     if post_type:
    #         serializer.save(author=self.request.user, type=post_type)
    #     else:
    #         serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

    # 조회수 증가 (중복 방지)
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_deleted:
            raise Http404("게시글을 찾을 수 없습니다.")

        user = request.user

        if user.is_authenticated:
            cache_key = f"network_post_view_{instance.id}_{user.id}"
        else:
            ip = request.META.get("REMOTE_ADDR")
            cache_key = f"network_post_view_{instance.id}_{ip}"

        if not cache.get(cache_key):
            Post.objects.filter(pk=instance.pk).update(view_count=F("view_count") + 1)
            cache.set(cache_key, True, timeout=60 * 60 * 24)
            instance.refresh_from_db(fields=["view_count"])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="게시글 좋아요 토글",
        responses={200: openapi.Response(description="좋아요 상태 반환")},
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        post = self.get_object()
        user = request.user

        reaction = Reaction.objects.filter(post=post, user=user).first()

        if reaction:
            reaction.delete()
            Post.objects.filter(pk=post.pk).update(like_count=F("like_count") - 1)
            post.refresh_from_db(fields=["like_count"])
            if post.like_count < 0:
                Post.objects.filter(pk=post.pk).update(like_count=0)
                post.refresh_from_db(fields=["like_count"])
            return Response({"liked": False, "like_count": post.like_count})

        Reaction.objects.create(post=post, user=user)
        Post.objects.filter(pk=post.pk).update(like_count=F("like_count") + 1)
        post.refresh_from_db(fields=["like_count"])
        return Response({"liked": True, "like_count": post.like_count})

    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        post = self.get_object()
        comments = post.comments.filter(parent__isnull=True, is_deleted=False)
        serializer = CommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def add_comment(self, request, pk=None):
        post = self.get_object()

        serializer = CommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        comment = serializer.save(author=request.user, post=post)

        Post.objects.filter(pk=post.pk).update(comment_count=F("comment_count") + 1)
        post.refresh_from_db(fields=["comment_count"])

        return Response(CommentSerializer(comment, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def pin(self, request, pk=None):
        post = self.get_object()

        if Post.objects.filter(is_pinned=True).exclude(pk=post.pk).exists():
            return Response({"detail": "이미 고정된 게시글이 존재합니다."}, status=400)

        post.is_pinned = True
        post.pinned_at = timezone.now()
        post.save(update_fields=["is_pinned", "pinned_at"])

        return Response({"detail": "게시글이 상단 고정되었습니다."})

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def unpin(self, request, pk=None):
        post = self.get_object()

        post.is_pinned = False
        post.pinned_at = None
        post.save(update_fields=["is_pinned", "pinned_at"])

        return Response({"detail": "고정이 해제되었습니다."})

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        pinned_post = queryset.filter(is_pinned=True).first()
        normal_posts = queryset.filter(is_pinned=False)

        page = self.paginate_queryset(normal_posts)
        serializer_context = {"request": request}

        pinned_data = PostListSerializer(pinned_post, context=serializer_context).data if pinned_post else None

        if page is not None:
            serializer = PostListSerializer(page, many=True, context=serializer_context)
            return self.get_paginated_response({"pinned": pinned_data, "posts": serializer.data})

        serializer = PostListSerializer(normal_posts, many=True, context=serializer_context)
        return Response({"pinned": pinned_data, "posts": serializer.data})


class CommentViewSet(ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Comment.objects.filter(is_deleted=False)

        user = self.request.user

        queryset = (
            Comment.objects
            .filter(is_deleted=False)
            .select_related("author", "post")
        )

        if user.is_authenticated:
            user_reactions = CommentReaction.objects.filter(
                comment=OuterRef("pk"),
                user=user
            )
            queryset = queryset.annotate(is_liked=Exists(user_reactions))
        else:
            queryset = queryset.annotate(
                is_liked=models.Value(False, output_field=models.BooleanField())
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.author != request.user:
            return Response({"detail": "삭제 권한이 없습니다."}, status=status.HTTP_403_FORBIDDEN)

        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

        Post.objects.filter(pk=instance.post_id).update(comment_count=F("comment_count") - 1)
        instance.post.refresh_from_db(fields=["comment_count"])
        if instance.post.comment_count < 0:
            Post.objects.filter(pk=instance.post_id).update(comment_count=0)

        return Response({"detail": "삭제 완료"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        reaction = CommentReaction.objects.filter(comment=comment, user=user).first()

        if reaction:
            reaction.delete()
            Comment.objects.filter(pk=comment.pk).update(like_count=F("like_count") - 1)
            comment.refresh_from_db(fields=["like_count"])
            if comment.like_count < 0:
                Comment.objects.filter(pk=comment.pk).update(like_count=0)
                comment.refresh_from_db(fields=["like_count"])
            return Response({"liked": False, "like_count": comment.like_count})

        CommentReaction.objects.create(comment=comment, user=user)
        Comment.objects.filter(pk=comment.pk).update(like_count=F("like_count") + 1)
        comment.refresh_from_db(fields=["like_count"])
        return Response({"liked": True, "like_count": comment.like_count})

class CategoryViewSet(ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    queryset = Category.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        t = self.request.query_params.get("type")  # ✅ student/graduate/qa
        if t:
            qs = qs.filter(type=t)
        return qs