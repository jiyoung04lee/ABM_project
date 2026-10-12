from django.db import transaction
from django.db.models import Max
from django.utils.html import strip_tags

from rest_framework import serializers

from apps.common.images import is_image_file, prepare_post_files
from apps.common.security import sanitize_html

from .models import Post, PostFile, Comment, Category


class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        fields = ["id", "file", "file_type", "order"]


class PostListSerializer(serializers.ModelSerializer):
    author_id = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    author_profile_image = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)
    content_preview = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "content_preview",
            "author_id",
            "author_name",
            "author_profile_image",
            "like_count",
            "is_liked",
            "comment_count",
            "created_at",
            "thumbnail",
            "is_pinned",
        ]

    def get_author_id(self, obj):
        if obj.is_anonymous or not obj.author:
            return None
        return obj.author.id

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

    def get_author_profile_image(self, obj):
        request = self.context.get("request")

        if obj.is_anonymous or not obj.author:
            return None

        if not obj.author.profile_image:
            return None

        url = obj.author.profile_image.url
        # S3/R2 스토리지의 url 은 이미 절대 주소이므로 그대로 반환
        if str(url).startswith(("http://", "https://")):
            return url

        # 로컬 스토리지 등 상대 경로인 경우 절대 URL 로 변환
        if request:
            return request.build_absolute_uri(url)

        return url

    def get_thumbnail(self, obj):
        request = self.context.get("request")
        # 글쓴이가 고른 대표 이미지. 대표가 없는 예전 글은 첫 번째 이미지
        image = obj.thumbnail
        if not image:
            first_image = obj.files.filter(file_type="image").first()
            image = first_image.file if first_image else None
        if not image:
            return None

        url = image.url
        if str(url).startswith(("http://", "https://")):
            return url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_content_preview(self, obj):
        plain = strip_tags(obj.content or "")
        return (plain[:200] + "…") if len(plain) > 200 else plain

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.is_anonymous:
            data["author"] = None
            data["author"] = None

        return data


class PostDetailSerializer(serializers.ModelSerializer):
    author_id = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    author_profile_image = serializers.SerializerMethodField()
    files = PostFileSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source="category.name", read_only=True
    )
    thumbnail = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "content",
            "author_id",
            "author_name",
            "author_profile_image",
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
            "is_pinned",
        ]
        read_only_fields = ["author"]

    def get_author_id(self, obj):
        if obj.is_anonymous or not obj.author:
            return None
        return obj.author.id

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "익명"
        return obj.author.nickname

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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_anonymous:
            data["author"] = None
        return data

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


def pick_thumbnail(image_files, thumbnail_index):
    """thumbnail_index는 이미지들 중 대표 이미지의 위치. 없거나 범위를 벗어나면 첫 번째 이미지."""
    if not image_files:
        return None
    if thumbnail_index is not None and 0 <= thumbnail_index < len(image_files):
        return image_files[thumbnail_index]
    return image_files[0]


class PostCreateSerializer(serializers.ModelSerializer):
    existing_files = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )
    # 수정 시 기존 첨부파일을 모두 지울 때. multipart는 빈 목록을 보낼 수 없어 따로 받는다
    clear_files = serializers.BooleanField(required=False, write_only=True)
    new_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )
    thumbnail_index = serializers.IntegerField(
        required=False,
        write_only=True,
    )

    class Meta:
        model = Post
        fields = [
            "title",
            "content",
            "is_anonymous",
            "category",
            "existing_files",
            "clear_files",
            "new_files",
            "thumbnail_index",
        ]

    def validate_content(self, value):
        return sanitize_html(value)

    def validate_new_files(self, files):
        # 형식·용량 검증 + 이미지는 브라우저 호환 JPEG/PNG로 변환 (HEIC, 초고해상도 원본 대응)
        return prepare_post_files(files)

    @transaction.atomic
    def create(self, validated_data):
        # 1. 파일 및 썸네일 데이터 분리
        new_files = validated_data.pop("new_files", [])
        thumbnail_index = validated_data.pop("thumbnail_index", None)
        # 수정에서만 의미 있는 값. 모델 생성 kwargs로 넘어가면 TypeError가 난다
        validated_data.pop("existing_files", None)
        validated_data.pop("clear_files", None)

        # 2. views.py의 serializer.save(author=user)에서 넘어온 값 처리
        # validated_data에 author가 있으면 꺼내고, 없으면 context의 user 사용
        user = self.context["request"].user
        author = validated_data.pop("author", user)

        # 3. 게시글 생성 (author 중복 에러 해결 핵심)
        post = Post.objects.create(author=author, **validated_data)

        created_files = []

        # 4. 첨부 파일 생성
        for index, file in enumerate(new_files):
            file_type = "image" if is_image_file(file) else "pdf"

            post_file = PostFile.objects.create(
                post=post,
                file=file,
                file_type=file_type,
                order=index,
            )
            created_files.append(post_file)

        # 5. 대표 이미지(썸네일) 설정
        image_files = [f for f in created_files if f.file_type == "image"]
        selected = pick_thumbnail(image_files, thumbnail_index)
        if selected:
            post.thumbnail = selected.file
            post.save(update_fields=["thumbnail"])

        return post

    @transaction.atomic
    def update(self, instance, validated_data):

        existing_ids = validated_data.pop("existing_files", None)
        clear_files = validated_data.pop("clear_files", False)
        new_files = validated_data.pop("new_files", None)
        thumbnail_index = validated_data.pop("thumbnail_index", None)

        # 기본 필드 업데이트
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 기존 파일 처리 (existing_files를 보내지 않으면 그대로 둔다)
        if clear_files:
            instance.files.all().delete()
        elif existing_ids is not None:
            instance.files.exclude(id__in=existing_ids).delete()

        # 새 파일 추가 (중간 파일이 지워져도 순서가 겹치지 않게 마지막 순서 뒤에 붙인다)
        if new_files:
            last_order = instance.files.aggregate(last=Max("order"))["last"]
            start = 0 if last_order is None else last_order + 1

            for index, file in enumerate(new_files):
                file_type = "image" if is_image_file(file) else "pdf"

                PostFile.objects.create(  # type: ignore[reportAttributeAccessIssue]
                    post=instance,
                    file=file,
                    file_type=file_type,
                    order=start + index,
                )

        # 썸네일 재설정 (기존 이미지 → 새 이미지 순서 기준)
        image_files = list(instance.files.filter(file_type="image").order_by("order"))
        if thumbnail_index is None:
            # 대표를 따로 고르지 않았으면 지금 대표를 유지 (지워졌으면 첫 번째 이미지)
            current_name = instance.thumbnail.name if instance.thumbnail else None
            current = next(
                (f for f in image_files if f.file.name == current_name), None
            )
            selected = current or pick_thumbnail(image_files, None)
        else:
            selected = pick_thumbnail(image_files, thumbnail_index)
        instance.thumbnail = selected.file if selected else None
        instance.save(update_fields=["thumbnail"])

        return instance


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_profile_image = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    is_liked = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "author",
            "author_id",
            "author_name",
            "author_profile_image",
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

    def get_author_id(self, obj):
        author = getattr(obj, "author", None)
        return author.id if author else None

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

    def get_replies(self, obj):
        if self.context.get("request") is None:
            return []

        replies = obj.replies.select_related("author").filter(is_deleted=False)
        return CommentSerializer(
            replies,
            many=True,
            context=self.context,
        ).data

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
