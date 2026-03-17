from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.utils.html import strip_tags
from django.core.files.base import ContentFile
from PIL import Image, ImageOps
from io import BytesIO
import os
import re

from .models import Post, PostFile, Comment, Category


def make_thumbnail(uploaded_file, size=(600, 338)):
    """
    주어진 이미지를 지정된 크기로 센터 크롭한 썸네일 파일(ContentFile)로 반환.
    실패 시 None 반환.
    """
    if not uploaded_file:
        return None

    try:
        # 현재 위치 보존
        try:
            current_pos = uploaded_file.tell()
        except (AttributeError, OSError):
            current_pos = None

        image = Image.open(uploaded_file)
        image = image.convert("RGB")

        thumb = ImageOps.fit(image, size, Image.LANCZOS)

        buffer = BytesIO()
        thumb.save(
            buffer,
            format="JPEG",
            quality=75,
        )
        buffer.seek(0)

        base_name, _ = os.path.splitext(
            getattr(uploaded_file, "name", "thumb")
        )
        thumb_name = f"{base_name}_thumb.jpg"

        file = ContentFile(buffer.read(), name=thumb_name)

        # 원본 파일 포인터 복원
        if current_pos is not None:
            try:
                uploaded_file.seek(current_pos)
            except (AttributeError, OSError):
                pass

        return file
    except Exception:
        # 썸네일 생성에 실패해도 글 작성은 계속 진행
        return None


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
    author_profile_image = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    content_preview = serializers.SerializerMethodField()
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
            "author_profile_image",
            "use_real_name",
            "content_preview",
            "view_count",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "thumbnail",
            "is_pinned",
        ]

    def get_content_preview(self, obj):
        plain = strip_tags(obj.content or "")
        plain = " ".join(plain.split())
        return plain[:200]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        if obj.use_real_name and obj.author:
            return obj.author.name or obj.author.nickname
        return obj.author.nickname if obj.author else "알 수 없음"

    def get_author_profile_image(self, obj):
        request = self.context.get("request")

        if obj.is_anonymous or not obj.author:
            return None

        if not obj.author.profile_image:
            return None

        url = obj.author.profile_image.url
        if str(url).startswith(("http://", "https://")):
            return url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_thumbnail(self, obj):
        request = self.context.get("request")
        if obj.thumbnail:
            url = obj.thumbnail.url
            if str(url).startswith(("http://", "https://")):
                return url
            if request:
                return request.build_absolute_uri(url)
            return url

        # 썸네일이 없으면 원본 이미지를 쓰지 않고
        # 프론트에서 기본 16:9 이미지를 사용하게 한다.
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
    author_id = serializers.SerializerMethodField()
    author_profile_image = serializers.SerializerMethodField()
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
            "author_id",
            "author_profile_image",
            "is_anonymous",
            "use_real_name",
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
        if obj.use_real_name and obj.author:
            return obj.author.name or obj.author.nickname
        return obj.author.nickname if obj.author else "알 수 없음"

    def get_author_id(self, obj):
        if obj.is_anonymous:
            return None
        return obj.author_id

    def get_author_profile_image(self, obj):
        request = self.context.get("request")
        if obj.is_anonymous or not obj.author:
            return None
        if not obj.author.profile_image:
            return None
        url = obj.author.profile_image.url
        if str(url).startswith(("http://", "https://")):
            return url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.reactions.filter(user=request.user).exists()
        return False

    def get_thumbnail(self, obj):
        request = self.context.get("request")
        if not obj.thumbnail:
            return None

        url = obj.thumbnail.url
        if str(url).startswith(("http://", "https://")):
            return url

        if request:
            return request.build_absolute_uri(url)

        return url

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
    thumbnail_index = serializers.IntegerField(required=False, write_only=True)
    files = PostFileSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        ref_name = "NetworkPostCreateSerializer"
        fields = [
            "id",
            "type",
            "title",
            "content",
            "is_anonymous",
            "use_real_name",
            "category",
            "existing_files",
            "new_files",
            "thumbnail_index",
            "files",
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
        thumbnail_index = validated_data.pop("thumbnail_index", None)

        post = Post.objects.create(**validated_data)

        image_files = []
        for index, file in enumerate(new_files):
            content_type = getattr(file, "content_type", "")
            file_type = "image" if content_type.startswith("image/") else "pdf"
            if file_type == "image":
                image_files.append((index, file))
            PostFile.objects.create(
                post=post,
                file=file,
                file_type=file_type,
                order=index,
            )

        # __BLOB_N__ 플레이스홀더를 실제 파일 URL로 치환
        if image_files and post.content:
            request = self.context.get("request")
            fixed_content = post.content

            for index, _ in image_files:
                file_obj = post.files.filter(
                    file_type="image", order=index
                ).first()
                if not file_obj or not file_obj.file:
                    continue

                url = file_obj.file.url
                if (
                    not str(url).startswith(("http://", "https://"))
                    and request
                ):
                    url = request.build_absolute_uri(url)

                placeholder = f'src="__BLOB_{index}__"'
                real = f'src="{url}"'
                fixed_content = fixed_content.replace(placeholder, real)

            # 매핑되지 않은 플레이스홀더 img 태그 제거
            fixed_content = re.sub(
                r'<img[^>]*src="__BLOB_\d+__"[^>]*\/?>',
                "",
                fixed_content,
                flags=re.IGNORECASE,
            )

            if fixed_content != post.content:
                post.content = fixed_content
                post.save(update_fields=["content"])

        if image_files:
            idx = 0
            if (
                thumbnail_index is not None
                and 0 <= thumbnail_index < len(image_files)
            ):
                idx = thumbnail_index
            _, thumb_source = image_files[idx]
            thumb_file = make_thumbnail(thumb_source)
            if thumb_file:
                post.thumbnail.save(thumb_file.name, thumb_file, save=True)

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
        if first_image and first_image.file:
            thumb_file = make_thumbnail(first_image.file)
            if thumb_file:
                instance.thumbnail.save(
                    thumb_file.name,
                    thumb_file,
                    save=False,
                )
        else:
            # 이미지가 없다면 썸네일도 제거
            if instance.thumbnail:
                instance.thumbnail.delete(save=False)
        instance.save(update_fields=["thumbnail"])

        return instance


# =========================
# 댓글
# =========================

class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        ref_name = "NetworkCommentSerializer"
        fields = [
            "id",
            "author",
            "author_id",
            "author_name",
            "content",
            "parent",
            "is_anonymous",
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

        if obj.is_anonymous:
            return "익명"

        return obj.author.nickname if obj.author else None

    def get_author_id(self, obj):
        author = getattr(obj, "author", None)
        return author.id if author else None

    def get_replies(self, obj):
        replies = obj.replies.select_related("author").filter(is_deleted=False)
        return CommentSerializer(replies, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_deleted:
            data["content"] = "삭제된 댓글입니다."

        if instance.is_anonymous:
            data["author"] = None

        return data
