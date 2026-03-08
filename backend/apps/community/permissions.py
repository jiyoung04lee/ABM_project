from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAuthorOrReadOnly(BasePermission):
    """
    작성자 또는 관리자만 수정/삭제 가능
    읽기(GET)는 모두 허용
    """

    def has_object_permission(self, request, view, obj):
        # 읽기 요청은 허용
        if request.method in SAFE_METHODS:
            return True
        # 관리자는 모든 글/댓글 수정·삭제 가능
        if getattr(request.user, "is_staff", False):
            return True
        # 작성자만 허용
        return obj.author == request.user