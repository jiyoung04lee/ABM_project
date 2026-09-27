"""
실패·대기 중인 새 글 메일 알림을 다시 보낸다.

    python manage.py retry_new_post_alerts            # 최근 24시간 이내 알림
    python manage.py retry_new_post_alerts --all      # 기간 제한 없이
    python manage.py retry_new_post_alerts --reset    # 시도 횟수를 다 쓴 실패 알림도 처음부터 다시
                                                      # (예: Gmail 앱 비밀번호를 고친 뒤)
"""
from collections import Counter

from django.core.management.base import BaseCommand

from apps.notifications.new_post_alerts import (
    RETRY_WINDOW,
    alert_recipients,
    deliver_alerts,
    reset_exhausted_alerts,
    retryable_alerts,
)

# 한 번 실행에서 반복하는 최대 횟수 (회당 최대 20건)
MAX_ROUNDS = 50


class Command(BaseCommand):
    help = "실패·대기 중인 새 글 메일 알림을 다시 보냅니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="24시간 제한 없이 재시도 대상 전체를 보냅니다.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="시도 횟수를 다 쓴 실패 알림의 횟수를 초기화하고 다시 보냅니다.",
        )

    def handle(self, *args, **options):
        if not alert_recipients():
            self.stderr.write("NEW_POST_ALERT_EMAIL이 비어 있어 보낼 수 없습니다.")
            return
        window = None if options["all"] else RETRY_WINDOW

        if options["reset"]:
            reset = reset_exhausted_alerts(window)
            self.stdout.write(f"실패 알림 {reset}건의 시도 횟수를 초기화했습니다.")

        totals: Counter = Counter()
        for _ in range(MAX_ROUNDS):
            results = deliver_alerts(window=window)
            if not results:
                break
            totals.update(results)

        remaining = retryable_alerts(window).count()
        if not totals:
            self.stdout.write("다시 보낼 알림이 없습니다.")
        else:
            summary = ", ".join(f"{status} {count}건" for status, count in sorted(totals.items()))
            self.stdout.write(f"재시도 결과: {summary}")
        if remaining:
            self.stdout.write(
                f"아직 남은 재시도 대상 {remaining}건 (재시도 간격이 지나지 않았거나 한도 초과). "
                "잠시 후 다시 실행하세요."
            )
