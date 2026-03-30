import random
import time
from django.core.mail import send_mail
from django.contrib.auth import get_user_model, authenticate, login  
from django.shortcuts import render, redirect
from django.contrib.admin import site as admin_site
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required

User = get_user_model()

def send_otp(request):
    """관리자 로그인 후 OTP 발송"""
    if not request.session.get('pre_otp_user_id'):
        return redirect('/admin-2026-mz9p/login/')

    otp_code = str(random.randint(100000, 999999))
    request.session['otp_code'] = otp_code
    request.session['otp_created_at'] = time.time()

    user = User.objects.get(id=request.session['pre_otp_user_id'])
    send_mail(
        subject='[관리자] OTP 인증번호',
        message=f'인증번호: {otp_code}\n5분 내로 입력해주세요.',
        from_email=None,
        recipient_list=[user.email],
    )
    return render(request, 'admin_otp/otp_verify.html')


def verify_otp(request):
    """OTP 검증"""
    if request.method != 'POST':
        return redirect('/admin-2026-mz9p/login/')

    input_code = request.POST.get('otp_code', '')
    saved_code = request.session.get('otp_code')
    created_at = request.session.get('otp_created_at', 0)
    expiry = getattr(settings, 'OTP_EXPIRY_SECONDS', 300)

    # 만료 확인
    if time.time() - created_at > expiry:
        return render(request, 'admin_otp/otp_verify.html', {'error': '인증번호가 만료됐어요. 다시 로그인해주세요.'})

    # 코드 확인
    if input_code != saved_code:
        return render(request, 'admin_otp/otp_verify.html', {'error': '인증번호가 틀렸어요.'})

    # 인증 성공 - Django auth 로그인 처리
    user_id = request.session.pop('pre_otp_user_id')
    request.session.pop('otp_code')
    request.session.pop('otp_created_at')

    user = User.objects.get(id=user_id)
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')  # ✅ 이 한 줄이 핵심

    return redirect('/admin-2026-mz9p/')


class AdminOTPSite(admin_site.__class__):
    """OTP 흐름이 추가된 커스텀 Admin Site"""

    def login(self, request, extra_context=None):
        if request.method == 'POST':
            email = request.POST.get('username')
            password = request.POST.get('password')
            user = authenticate(request, username=email, password=password)

            if user and user.is_staff:
                request.session['pre_otp_user_id'] = user.id
                return redirect('/admin-otp/send/')

        return super().login(request, extra_context)