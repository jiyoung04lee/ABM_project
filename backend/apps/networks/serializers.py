from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.db import transaction
import os

from .models import Post, PostFile, Comment, Category


# =========================
# Category
# =========================

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        ref_name = "NetworkCategorySerializer"
        fields = ["id", "type", "name", "slug"]


# =========================
# 파일
# =========================

class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        ref_name = "NetworkPostFileSerializer"
        fields = ["id", "file", "file_type", "order"]


# =========================
# 게시글 목록
# =========================

class PostListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    type = serializers.CharField(read_only=True)
    category_name = serializers.CharField(
        source="category.name", read_only=True
    )

    class Meta:
        model = Post
        ref_name = "NetworkPostListSerializer"
        fields = [
            "id",
            "type",
            "category",
            "category_name",
            "title",
            "author_name",
            "view_count",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "thumbnail",
            "is_pinned",
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

    def get_thumbnail(self, obj):
        request = self.context.get("request")
        first_image = obj.files.filter(file_type="image").first()
        if first_image and request:
            return request.build_absolute_uri(first_image.file.url)
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_anonymous:
            data["author"] = None
        return data


# =========================
# 게시글 상세
# =========================

class PostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    files = PostFileSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source="category.name", read_only=True
    )
    thumbnail = serializers.SerializerMethodField()
    type = serializers.CharField(read_only=True)

    class Meta:
        model = Post
        ref_name = "NetworkPostDetailSerializer"
        fields = [
            "id",
            "type",
            "title",
            "content",
            "author_name",
            "is_anonymous",
            "view_count",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "updated_at",
            "thumbnail",
            "files",
            "category",
            "category_name",
            "is_pinned",
        ]
        read_only_fields = ["author"]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.reactions.filter(user=request.user).exists()
        return False

    def get_thumbnail(self, obj):
        request = self.context.get("request")
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_anonymous:
            data["author"] = None
        return data


# =========================
# 게시글 작성/수정
# =========================

class PostCreateSerializer(serializers.ModelSerializer):
    existing_files = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )
    new_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Post
        ref_name = "NetworkPostCreateSerializer"
        fields = [
            "type",
            "title",
            "content",
            "is_anonymous",
            "category",
            "existing_files",
            "new_files",
        ]

    def validate_category(self, category):
        post_type = self.initial_data.get("type")
        if not post_type:
            raise ValidationError("게시글 타입(type)이 필요합니다.")

        if category.type != post_type:
            raise ValidationError("해당 탭에서 사용할 수 없는 카테고리입니다.")

        return category

    def validate_new_files(self, files):
        allowed_image_ext = [".jpg", ".jpeg", ".png", ".webp"]
        allowed_pdf_ext = [".pdf"]

        for file in files:
            ext = os.path.splitext(file.name)[1].lower()
            content_type = getattr(file, "content_type", "")

            if ext in allowed_image_ext:
                if not content_type.startswith("image/"):
                    raise ValidationError("잘못된 이미지 파일입니다.")
                if file.size > 5 * 1024 * 1024:
                    raise ValidationError("이미지 파일은 5MB 이하만 가능합니다.")

            elif ext in allowed_pdf_ext:
                if content_type != "application/pdf":
                    raise ValidationError("잘못된 PDF 파일입니다.")
                if file.size > 10 * 1024 * 1024:
                    raise ValidationError("PDF 파일은 10MB 이하만 가능합니다.")
            else:
                raise ValidationError("허용되지 않은 파일 형식입니다.")

        return files

    @transaction.atomic
    def create(self, validated_data):
        new_files = validated_data.pop("new_files", [])
        user = self.context["request"].user

        post = Post.objects.create(author=user, **validated_data)

        first_image = None

        for index, file in enumerate(new_files):
            content_type = getattr(file, "content_type", "")
            file_type = "image" if content_type.startswith("image/") else "pdf"

            if file_type == "image" and first_image is None:
                first_image = file

            PostFile.objects.create(
                post=post,
                file=file,
                file_type=file_type,
                order=index,
            )

        if first_image:
            post.thumbnail = first_image
            post.save(update_fields=["thumbnail"])

        return post

    @transaction.atomic
    def update(self, instance, validated_data):
        existing_ids = validated_data.pop("existing_files", None)
        new_files = validated_data.pop("new_files", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if existing_ids is not None:
            instance.files.exclude(id__in=existing_ids).delete()

        if new_files:
            current_count = instance.files.count()

            for index, file in enumerate(new_files):
                content_type = getattr(file, "content_type", "")
                file_type = (
                    "image" if content_type.startswith("image/") else "pdf"
                )

                PostFile.objects.create(
                    post=instance,
                    file=file,
                    file_type=file_type,
                    order=current_count + index,
                )

        first_image = instance.files.filter(file_type="image").first()
        instance.thumbnail = first_image.file if first_image else None
        instance.save(update_fields=["thumbnail"])

        return instance


# =========================
# 댓글
# =========================

class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        ref_name = "NetworkCommentSerializer"
        fields = [
            "id",
            "author",
            "author_name",
            "content",
            "parent",
            "is_deleted",
            "created_at",
            "replies",
            "is_liked",
            "like_count",
        ]
        read_only_fields = ["author"]

    def get_author_name(self, obj):
        if obj.is_deleted:
            return None
        return obj.author.nickname if obj.author else None

    def get_replies(self, obj):
        replies = obj.replies.select_related("author").filter(is_deleted=False)
        return CommentSerializer(replies, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_deleted:
            data["content"] = "삭제된 댓글입니다."

        if instance.post.is_anonymous:
            data["author"] = None

        return data
