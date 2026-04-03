"""관리자 OTP 메일 — SendGrid HTTP API (SMTP send_mail보다 지연·타임아웃 이슈가 적음)."""

import logging
import os

from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)


def send_admin_otp_email(to_email: str, otp_code: str, subject: str) -> bool:
    """
    SendGrid v3 API로 OTP 발송. 성공 시 True, 실패 시 False (예외는 잡고 로깅).
    """
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        logger.error("send_admin_otp_email: SENDGRID_API_KEY not set")
        return False
    if not (to_email or "").strip():
        logger.error("send_admin_otp_email: empty recipient")
        return False

    body = f"인증번호: {otp_code}\n5분 내로 입력해주세요."
    try:
        message = Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=to_email.strip(),
            subject=subject,
            plain_text_content=body,
        )
        SendGridAPIClient(api_key).send(message)
        return True
    except Exception:
        logger.exception("send_admin_otp_email: SendGrid send failed")
        return False
