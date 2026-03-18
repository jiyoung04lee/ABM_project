from django.db import models
from django.conf import settings

# Category (네트워크 필터 칩용)
class Category(models.Model):
    TYPE_CHOICES = [
        ("student", "재학생"),
        ("graduate", "졸업생"),
        ("qa", "Q&A"),
    ]
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, db_index=True)
    name = models.CharField(max_length=50)
    # 탭마다 같은 slug(예: intern)를 쓰려면 unique=True면 터짐 → 복합 유니크로 변경
    slug = models.SlugField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["type", "slug"],
                name="unique_network_category_type_slug",
            )
        ]

    def __str__(self):
        return f"[{self.type}] {self.name}"


# Post (네트워크 글)
class Post(models.Model):
    TYPE_CHOICES = (
        ("student", "재학생"),
        ("graduate", "졸업생"),
        ("qa", "Q&A"),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="network_posts",  # community.posts랑 충돌 방지
    )

    # 재학생/졸업생/Q&A 탭
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="student",
        db_index=True,
    )

    # 필터 칩(인턴/공모전/학교프로그램/전공/국제교류 등)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,  # 카테고리 필수로 만들 거면 null=False 추천
        related_name="posts",
    )

    title = models.CharField(max_length=200)
    content = models.TextField()

    is_anonymous = models.BooleanField(default=False)
    use_real_name = models.BooleanField(default=False)

    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)

    thumbnail = models.ImageField(
        upload_to="network/thumbnails/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False)

    # 네트워크에서 고정글(상단 노출) 필요하면 유지
    is_pinned = models.BooleanField(default=False)
    pinned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["like_count"]),
            models.Index(fields=["is_pinned"]),
            models.Index(fields=["type"]),       # 탭 필터
            models.Index(fields=["category"]),   # 칩 필터
        ]

    def __str__(self):
        return self.title


# PostFile (첨부파일)
class PostFile(models.Model):
    FILE_TYPE_CHOICES = (
        ("image", "Image"),
        ("pdf", "PDF"),
    )

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="files",
        null=True,  
        blank=True, 
    )

    file = models.FileField(upload_to="network/posts/")
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]


# Reaction (좋아요)
class Reaction(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="network_post_reactions",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user"],
                name="unique_network_post_user_reaction",
            )
        ]


# Comment
class Comment(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="network_comments",
    )

    content = models.TextField()
    is_anonymous = models.BooleanField(default=False) 
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="replies",
    )

    is_deleted = models.BooleanField(default=False)
    like_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


# 댓글 좋아요
class CommentReaction(models.Model):
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="network_comment_reactions",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="unique_network_comment_user_reaction",
            )
        ]
        
# Draft (임시저장)
class Draft(models.Model):
    TYPE_CHOICES = (
        ("student", "재학생"),
        ("graduate", "졸업생"),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="network_drafts",
    )
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    content = models.TextField()  # HTML 전체 그대로 저장 (이미지 URL 포함)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["author", "type"],
                name="unique_network_draft_author_type",
            )
        ]

    def __str__(self):
        return f"[Draft] {self.author} - {self.type} : {self.title}"