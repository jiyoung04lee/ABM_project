from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User Admin"""

    list_display = (
        "id",
        "email",
        "nickname",
        "user_type",
        "student_id",
        "grade",
        "is_verified",
        "is_staff",
        "is_active",
        "created_at",
    )
    list_filter = (
        "user_type",
        "is_verified",
        "is_staff",
        "is_active",
        "created_at",
    )
    search_fields = ("email", "nickname", "student_id")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("nickname", "user_type", "student_id", "grade")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "is_verified",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "created_at", "updated_at")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "nickname",
                    "user_type",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                    "is_verified",
                ),
            },
        ),
    )

    def get_readonly_fields(self, request, obj=None):
        """생성일시는 항상 읽기 전용"""
        readonly = list(super().get_readonly_fields(request, obj))
        if obj:  # 편집 모드
            readonly.append("email")  # 이메일은 수정 불가
        return readonly
