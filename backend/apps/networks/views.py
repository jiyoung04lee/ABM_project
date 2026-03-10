from django.db import models
from django.db.models import Q, Exists, OuterRef, F
from django.utils import timezone
from django.http import Http404
from django.core.cache import cache

from rest_framework import status
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.permissions import (
    IsAuthenticatedOrReadOnly,
    IsAuthenticated,
    IsAdminUser,
    AllowAny,
)
from rest_framework.response import Response
from rest_framework.decorators import action

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
from logs.utils import (
    create_event_log,
    get_author_grade_info,
    get_viewer_grade_info,
)


class CategoryViewSet(ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    queryset = Category.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        t = self.request.query_params.get("type")
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
                is_liked=models.Value(
                    False, output_field=models.BooleanField()
                )
            )

        # 탭 필터: type=student|graduate|qa
        post_type = self.request.query_params.get("type")
        if post_type:
            queryset = queryset.filter(type=post_type)

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)

        if post_type:
            queryset = queryset.filter(category__type=post_type)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(content__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
        if ordering == "likes":
            queryset = queryset.order_by(
                "-is_pinned", "-pinned_at", "-like_count"
            )
        else:
            queryset = queryset.order_by(
                "-is_pinned", "-pinned_at", "-created_at"
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return PostListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return PostCreateSerializer
        return PostDetailSerializer

    def perform_create(self, serializer):
        post = serializer.save()
        viewer = get_viewer_grade_info(self.request.user)
        create_event_log(
            event_type="post_create",
            section="network",
            page="/network",
            post_id=post.pk,
            user=self.request.user,
            **viewer,
        )

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

            viewer = get_viewer_grade_info(user if user.is_authenticated else None)
            author = get_author_grade_info(getattr(instance, "author", None))
            create_event_log(
                event_type="post_view",
                section="network",
                post_id=instance.pk,
                user=user if user.is_authenticated else None,
                **viewer,
                **author,
            )

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

        viewer = get_viewer_grade_info(user)
        author = get_author_grade_info(post.author)
        create_event_log(
            event_type="like",
            section="network",
            post_id=post.pk,
            user=user,
            **viewer,
            **author,
        )

        return Response({"liked": True, "like_count": post.like_count})

    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        post = self.get_object()
        comments = (
            post.comments
            .filter(parent__isnull=True, is_deleted=False)
            .select_related("author")
            .prefetch_related("replies__author")
        )
        serializer = CommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def add_comment(self, request, pk=None):
        post = self.get_object()

        serializer = CommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        comment = serializer.save(
            author=request.user,
            post=post,
            is_anonymous=request.data.get("is_anonymous", False)
        )

        Post.objects.filter(pk=post.pk).update(comment_count=F("comment_count") + 1)
        post.refresh_from_db(fields=["comment_count"])

        viewer = get_viewer_grade_info(request.user)
        author = get_author_grade_info(post.author)
        create_event_log(
            event_type="comment",
            section="network",
            post_id=post.pk,
            **viewer,
            **author,
        )

        return Response(CommentSerializer(comment, context={"request": request}).data)

    MAX_PINNED = 3

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def pin(self, request, pk=None):
        post = self.get_object()

        if post.is_pinned:
            return Response({"detail": "이미 고정된 게시글입니다."}, status=400)
        if Post.objects.filter(is_pinned=True).count() >= self.MAX_PINNED:
            return Response(
                {"detail": f"고정 글은 최대 {self.MAX_PINNED}개까지 가능합니다."},
                status=400,
            )

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
        # 검색 이벤트 로그
        search_kw = request.query_params.get("search", "").strip()
        if search_kw:
            viewer = get_viewer_grade_info(
                request.user if request.user.is_authenticated else None
            )
            interest = None
            if request.user.is_authenticated and getattr(request.user, "interests", None):
                interests = request.user.interests or []
                if interests:
                    interest = interests[0]
            create_event_log(
                event_type="search",
                section="network",
                page="/network",
                search_keyword=search_kw,
                interest_at_event=interest,
                user=request.user if request.user.is_authenticated else None,
                **viewer,
            )

        queryset = self.filter_queryset(self.get_queryset())

        pinned_qs = queryset.filter(is_pinned=True).order_by("-pinned_at")[: self.MAX_PINNED]
        normal_posts = queryset.filter(is_pinned=False)

        page = self.paginate_queryset(normal_posts)
        serializer_context = {"request": request}

        pinned_data = PostListSerializer(
            pinned_qs, many=True, context=serializer_context
        ).data

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
