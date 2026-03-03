from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.db import transaction
import os

from .models import Post, PostFile, Comment, Category

# 파일 Serializer
class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        fields = ["id", "file", "file_type", "order"]

# 게시글 목록 Serializer
class PostListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "content",
            "author_name",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "thumbnail",
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

    def get_thumbnail(self, obj):
        first_image = obj.files.filter(file_type="image").first()
        if first_image:
            return first_image.file.url
        return None
    
    
    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_anonymous:
            data["author"] = None

        return data

# 게시글 상세 Serializer
class PostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    files = PostFileSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    thumbnail = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
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
            "comments",
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
    
    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_anonymous:
            data["author"] = None

        return data
    
    def get_thumbnail(self, obj):
        request = self.context.get("request")
        if obj.thumbnail:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None
    
    def get_comments(self, obj):
        request = self.context.get("request")

        comments = (
            obj.comments
            .filter(parent__isnull=True, is_deleted=False)
            .select_related("author")
        )

        return CommentSerializer(
            comments,
            many=True,
            context={"request": request}
        ).data


class PostCreateSerializer(serializers.ModelSerializer):
    existing_files = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    new_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True
    )
    thumbnail_index = serializers.IntegerField(
        required=False,
        write_only=True
    )

    class Meta:
        model = Post
        fields = [
            "title",
            "content",
            "is_anonymous",
            "category",
            "existing_files",
            "new_files",
            "thumbnail_index", 
        ]
    # 파일 검증 추가
    def validate_files(self, files):
        allowed_image_ext = [".jpg", ".jpeg", ".png", ".webp"]
        allowed_pdf_ext = [".pdf"]

        for file in files:
            ext = os.path.splitext(file.name)[1].lower()
            content_type = getattr(file, "content_type", "")

            if ext in allowed_image_ext:
                # 이미지 타입 검증
                if not content_type.startswith("image/"):
                    raise ValidationError("잘못된 이미지 파일입니다.")

                # 이미지 최대 5MB
                if file.size > 5 * 1024 * 1024:
                    raise ValidationError("이미지 파일은 5MB 이하만 가능합니다.")

            elif ext in allowed_pdf_ext:
                # PDF 타입 검증
                if content_type != "application/pdf":
                    raise ValidationError("잘못된 PDF 파일입니다.")

                # PDF 최대 10MB
                if file.size > 10 * 1024 * 1024:
                    raise ValidationError("PDF 파일은 10MB 이하만 가능합니다.")

            else:
                raise ValidationError("허용되지 않은 파일 형식입니다.")

        return files

    # 트랜잭션 처리 추가 (안전성 강화)
    @transaction.atomic
    def create(self, validated_data):
        new_files = validated_data.pop("new_files", [])
        thumbnail_index = validated_data.pop("thumbnail_index", None)

        user = self.context["request"].user
        post = Post.objects.create(author=user, **validated_data)

        created_files = []

        for index, file in enumerate(new_files):
            content_type = getattr(file, "content_type", "")

            if content_type.startswith("image/"):
                file_type = "image"
            else:
                file_type = "pdf"

            post_file = PostFile.objects.create(
                post=post,
                file=file,
                file_type=file_type,
                order=index
            )

            created_files.append(post_file)

        # 대표 이미지 설정
        if thumbnail_index is not None:
            try:
                selected_file = created_files[int(thumbnail_index)]

                if selected_file.file_type == "image":
                    post.thumbnail = selected_file.file
                    post.save(update_fields=["thumbnail"])

            except (IndexError, ValueError):
                pass

        return post
    
    @transaction.atomic
    def update(self, instance, validated_data):

        existing_ids = validated_data.pop("existing_files", None)
        new_files = validated_data.pop("new_files", None)

        # 기본 필드 업데이트
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 기존 파일 처리
        if existing_ids is not None:
            instance.files.exclude(id__in=existing_ids).delete()

        # 새 파일 추가
        if new_files:
            current_count = instance.files.count()

            for index, file in enumerate(new_files):
                content_type = getattr(file, "content_type", "")

                if content_type.startswith("image/"):
                    file_type = "image"
                else:
                    file_type = "pdf"

                PostFile.objects.create(
                    post=instance,
                    file=file,
                    file_type=file_type,
                    order=current_count + index
                )

        # 썸네일 재설정
        first_image = instance.files.filter(file_type="image").first()
        instance.thumbnail = first_image.file if first_image else None
        instance.save(update_fields=["thumbnail"])

        return instance
    
# 댓글 
class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "author",
            "author_name",
            "content",
            "parent",
            "is_deleted",
            "is_anonymous",
            "created_at",
            "replies",
            "is_liked",
            "like_count",
        ]
        read_only_fields = ["author"]

    def get_author_name(self, obj):
        if obj.is_deleted:
            return None
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

    def get_replies(self, obj):
        if self.context.get("request") is None:
            return []

        replies = obj.replies.select_related("author").filter(is_deleted=False)
        return CommentSerializer(replies, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_deleted:
            data["content"] = "삭제된 댓글입니다."

        if instance.is_anonymous:
            data["author"] = None

        return data


class MyActivityCommentSerializer(serializers.ModelSerializer):
    """내 활동 - 작성 댓글용 Serializer (원글 제목 포함)"""

    post_id = serializers.IntegerField(source="post.id", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "post_id",
            "post_title",
            "content",
            "like_count",
            "created_at",
        ]

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "group"]