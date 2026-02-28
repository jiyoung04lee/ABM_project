from django.db import models
from django.conf import settings

# Category
class Category(models.Model):

    GROUP_CHOICES = (
        ("community", "커뮤니티"),
        ("network_student", "네트워크-재학생"),
        ("network_graduate", "네트워크-졸업생"),
        ("network_qna", "네트워크-QNA"),
    )

    name = models.CharField(max_length=50)
    slug = models.SlugField()
    group = models.CharField(
        max_length=30,
        choices=GROUP_CHOICES,
        default="community"  
)

    class Meta:
        unique_together = ("slug", "group")

    def __str__(self):
        return f"{self.group} - {self.name}"

# Post
class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name="posts",
    )

    title = models.CharField(max_length=200)
    content = models.TextField()

    is_anonymous = models.BooleanField(default=False)

    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)

    thumbnail = models.ImageField(
        upload_to="community/thumbnails/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    pinned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["like_count"]),
            models.Index(fields=["is_pinned"]),
        ]

    def __str__(self):
        return self.title

# PostFile
class PostFile(models.Model):
    FILE_TYPE_CHOICES = (
        ("image", "Image"),
        ("pdf", "PDF"),
    )

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="files",
    )

    file = models.FileField(upload_to="community/posts/")
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
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user"],
                name="unique_post_user_reaction"
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
    )

    content = models.TextField()

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
    is_anonymous = models.BooleanField(default=False)

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
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="unique_comment_user_reaction"
            )
        ]