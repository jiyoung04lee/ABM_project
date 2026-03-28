import os
import random
import time

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.admin import site as admin_site
from django.core.mail import send_mail
from django.shortcuts import redirect, render

User = get_user_model()


def _admin_base_path() -> str:
    """config/urls.py 의 ADMIN_URL_PATH 와 동일해야 함."""
    return os.environ.get("ADMIN_URL_PATH", "admin").strip("/")


def _admin_login_url() -> str:
    return f"/{_admin_base_path()}/login/"


def _admin_home_url() -> str:
    return f"/{_admin_base_path()}/"


def send_otp(request):
    """관리자 로그인 후 OTP 발송.

    유효한 OTP가 세션에 이미 있으면(만료 전) 재발송·재생성하지 않음.
    새로고침으로 인해 메일과 세션 번호가 어긋나는 문제를 방지한다.
    """
    if not request.session.get("pre_otp_user_id"):
        return redirect(_admin_login_url())

    expiry = getattr(settings, "OTP_EXPIRY_SECONDS", 300)
    now = time.time()
    existing_code = request.session.get("otp_code")
    created_at = request.session.get("otp_created_at", 0)

    if existing_code and (now - created_at) <= expiry:
        return render(request, "admin_otp/otp_verify.html")

    otp_code = str(random.randint(100000, 999999))
    request.session["otp_code"] = otp_code
    request.session["otp_created_at"] = now
    request.session.modified = True

    user = User.objects.get(id=request.session["pre_otp_user_id"])
    send_mail(
        subject="[관리자] OTP 인증번호",
        message=f"인증번호: {otp_code}\n5분 내로 입력해주세요.",
        from_email=None,
        recipient_list=[user.email],
    )
    return render(request, "admin_otp/otp_verify.html")


def verify_otp(request):
    """OTP 검증"""
    if request.method != "POST":
        return redirect(_admin_login_url())

    input_code = (request.POST.get("otp_code") or "").strip()
    saved_code = request.session.get("otp_code")
    created_at = request.session.get("otp_created_at", 0)
    expiry = getattr(settings, "OTP_EXPIRY_SECONDS", 300)

    if not request.session.get("pre_otp_user_id"):
        return render(
            request,
            "admin_otp/otp_verify.html",
            {"error": "세션이 만료됐어요. 관리자 로그인부터 다시 해주세요."},
        )

    if saved_code is None:
        return render(
            request,
            "admin_otp/otp_verify.html",
            {"error": "인증번호가 없습니다. 관리자 로그인부터 다시 해주세요."},
        )

    if time.time() - created_at > expiry:
        return render(
            request,
            "admin_otp/otp_verify.html",
            {"error": "인증번호가 만료됐어요. 다시 로그인해주세요."},
        )

    if input_code != saved_code:
        return render(
            request,
            "admin_otp/otp_verify.html",
            {"error": "인증번호가 틀렸어요."},
        )

    user_id = request.session.pop("pre_otp_user_id")
    request.session.pop("otp_code", None)
    request.session.pop("otp_created_at", None)
    request.session["is_admin_verified"] = True
    request.session["admin_user_id"] = user_id

    return redirect(_admin_home_url())


class AdminOTPSite(admin_site.__class__):
    """OTP 흐름이 추가된 커스텀 Admin Site"""

    def login(self, request, extra_context=None):
        if request.method == "POST":
            email = request.POST.get("username")
            password = request.POST.get("password")
            user = authenticate(request, username=email, password=password)

            if user and user.is_staff:
                request.session["pre_otp_user_id"] = user.id
                request.session.pop("otp_code", None)
                request.session.pop("otp_created_at", None)
                request.session.modified = True
                return redirect("/admin-otp/send/")

        return super().login(request, extra_context)
