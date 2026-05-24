import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def send_admin_otp_email(to_email: str, otp_code: str, subject: str) -> bool:
    if not (to_email or "").strip():
        logger.error("send_admin_otp_email: empty recipient")
        return False

    body = f"인증번호: {otp_code}\n5분 내로 입력해주세요."
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email.strip()],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("send_admin_otp_email: Gmail send failed")
        return False