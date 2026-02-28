from rest_framework import status
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny

from django.db import models
from django.db.models import Q, Exists, OuterRef, Prefetch, F
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

class PostViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        # Swagger 문서 생성 중이면 최소 queryset 반환
        if getattr(self, 'swagger_fake_view', False):
            return Post.objects.filter(is_deleted=False)

        user = self.request.user

        queryset = (
            Post.objects
            .filter(is_deleted=False)
            .select_related("author", "category")
            .prefetch_related("files")
        )

        # 로그인 사용자 기준 좋아요 여부 annotation
        if user.is_authenticated:
            user_reactions = Reaction.objects.filter(
                post=OuterRef("pk"),
                user=user
            )
            queryset = queryset.annotate(
                is_liked=Exists(user_reactions)
            )
        else:
            queryset = queryset.annotate(
                is_liked=models.Value(
                    False,
                    output_field=models.BooleanField()
                )
            )

        # 카테고리 필터
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)

        # 검색
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(content__icontains=search)
            )

        # 정렬
        ordering = self.request.query_params.get("ordering")

        if ordering == "likes":
            queryset = queryset.order_by(
                "-is_pinned",
                "-pinned_at",
                "-like_count"
            )
        else:
            queryset = queryset.order_by(
                "-is_pinned",
                "-pinned_at",
                "-created_at"
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return PostListSerializer
        if self.action == "create":
            return PostCreateSerializer
        return PostDetailSerializer

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()

    @swagger_auto_schema(
        operation_description="게시글 좋아요 토글",
        responses={
            200: openapi.Response(
                description="좋아요 상태 반환"
            )
        }
    )
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        post = self.get_object()
        user = request.user

        reaction = Reaction.objects.filter(post=post, user=user).first()

        if reaction:
            reaction.delete()

            Post.objects.filter(pk=post.pk).update(
                like_count=F("like_count") - 1
            )

            post.refresh_from_db()

            return Response({
                "liked": False,
                "like_count": post.like_count
            })

        else:
            Reaction.objects.create(post=post, user=user)

            Post.objects.filter(pk=post.pk).update(
                like_count=F("like_count") + 1
            )

            post.refresh_from_db()

            return Response({
                "liked": True,
                "like_count": post.like_count
            })
        
    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        post = self.get_object()
        comments = post.comments.filter(parent__isnull=True, is_deleted=False)
        serializer = CommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def add_comment(self, request, pk=None):
        post = self.get_object()

        serializer = CommentSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        comment = serializer.save(
            author=request.user,
            post=post
        )

        # 여기서 직접 세팅 (더 안전)
        comment.is_anonymous = request.data.get("is_anonymous", False)
        comment.save()

        post.comment_count = F("comment_count") + 1
        post.save(update_fields=["comment_count"])

        comment.refresh_from_db()

        return Response(
            CommentSerializer(comment, context={"request": request}).data
        )
    
    # 조회수 증가
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        # 삭제된 게시글 차단
        if instance.is_deleted:
            raise Http404("게시글을 찾을 수 없습니다.")
        user = request.user

        # 로그인 사용자 기준 조회수 중복 방지
        if user.is_authenticated:
            cache_key = f"post_view_{instance.id}_{user.id}"

            if not cache.get(cache_key):
                instance.view_count += 1
                instance.save(update_fields=["view_count"])
                cache.set(cache_key, True, timeout=60 * 60 * 24)  # 24시간
        else:
            # 비로그인 사용자는 IP 기준
            ip = request.META.get("REMOTE_ADDR")
            cache_key = f"post_view_{instance.id}_{ip}"

            if not cache.get(cache_key):
                instance.view_count += 1
                instance.save(update_fields=["view_count"])
                cache.set(cache_key, True, timeout=60 * 60 * 24)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    # 게시글 고정/해제 (관리자 전용)
    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def pin(self, request, pk=None):
        post = self.get_object()

        if Post.objects.filter(is_pinned=True).exclude(pk=post.pk).exists():
            return Response(
                {"detail": "이미 고정된 게시글이 존재합니다."},
                status=400
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
        queryset = self.filter_queryset(self.get_queryset())

        # 고정글 분리 (최대 1개)
        pinned_post = queryset.filter(is_pinned=True).first()
        normal_posts = queryset.filter(is_pinned=False)
        page = self.paginate_queryset(normal_posts)
        serializer_context = {"request": request}

        pinned_data = None
        if pinned_post:
            pinned_data = PostListSerializer(
                pinned_post,
                context=serializer_context
            ).data

        if page is not None:
            serializer = PostListSerializer(
                page,
                many=True,
                context=serializer_context
            )

            return self.get_paginated_response({
                "pinned": pinned_data,
                "posts": serializer.data
            })

        serializer = PostListSerializer(
            normal_posts,
            many=True,
            context=serializer_context
        )

        return Response({
            "pinned": pinned_data,
            "posts": serializer.data
        })
        
class CommentViewSet(ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
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
            queryset = queryset.annotate(
                is_liked=Exists(user_reactions)
            )
        else:
            queryset = queryset.annotate(
                is_liked=models.Value(
                    False,
                    output_field=models.BooleanField()
                )
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.author != request.user:
            return Response(
                {"detail": "삭제 권한이 없습니다."},
                status=status.HTTP_403_FORBIDDEN
            )

        instance.is_deleted = True
        instance.save()

        post = instance.post
        post.comment_count = max(0, post.comment_count - 1)
        post.save()

        return Response({"detail": "삭제 완료"})
    
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        reaction = CommentReaction.objects.filter(
            comment=comment,
            user=user
        ).first()

        if reaction:
            reaction.delete()

            Comment.objects.filter(pk=comment.pk).update(
                like_count=F("like_count") - 1
            )

            comment.refresh_from_db()

            return Response({
                "liked": False,
                "like_count": comment.like_count
            })

        else:
            CommentReaction.objects.create(
                comment=comment,
                user=user
            )

            Comment.objects.filter(pk=comment.pk).update(
                like_count=F("like_count") + 1
            )

            comment.refresh_from_db()

            return Response({
                "liked": True,
                "like_count": comment.like_count
            })

class CategoryViewSet(ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    permission_classes = [AllowAny]

    def get_queryset(self):
        group = self.request.query_params.get("group")
        if group:
            return self.queryset.filter(group=group)
        return self.queryset