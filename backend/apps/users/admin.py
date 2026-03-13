from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User, StudentRegistry


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User Admin"""

    list_display = (
        "id",
        "email",
        "name",
        "nickname",
        "user_type",
        "student_id",
        "grade",
        "admission_year",
        "is_multi_major",
        "multi_major_approved",
        "social_provider",
        "kakao_id",
        "is_profile_complete",
        "is_verified",
        "is_staff",
        "is_active",
        "created_at",
    )

    list_filter = (
        "user_type",
        "is_multi_major",
        "multi_major_approved",
        "social_provider",
        "is_profile_complete",
        "is_verified",
        "is_staff",
        "is_active",
        "created_at",
    )

    search_fields = (
        "email",
        "nickname",
        "student_id",
        "kakao_id",
    )

    ordering = ("-created_at",)

    readonly_fields = (
        "created_at",
        "updated_at",
        "last_login",
    )

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "email",
                    "password",
                    "social_provider",
                    "kakao_id",
                )
            },
        ),
        (
            _("Personal info"),
            {
                "fields": (
                    "name",
                    "nickname",
                    "department",
                    "user_type",
                    "student_id",
                    "grade",
                    "admission_year",
                    "bio",
                    "profile_image",
                    "is_multi_major",
                    "multi_major_image",
                    "multi_major_approved",
                )
            },
        ),
        (
            _("Onboarding"),
            {
                "fields": (
                    "personal_info_consent",
                    "is_profile_complete",
                )
            },
        ),
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
        (
            _("Important dates"),
            {
                "fields": (
                    "last_login",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "name",
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
        readonly: list[str] = list(super().get_readonly_fields(request, obj))

        if obj:
            readonly.append("email")

        return readonly


@admin.register(StudentRegistry)
class StudentRegistryAdmin(admin.ModelAdmin):
    list_display = ("student_id", "name")
    search_fields = ("student_id", "name")
