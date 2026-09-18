"""
매월 1일 00:00 KST 에 실행하는 점수 초기화 커맨드.

1. 학년 그룹별(1학년 / 2학년 / 3·4학년) 1위를 MonthlyWinner에 저장
2. 전체 User.score → 0
3. ScoreHistory 삭제 (좋아요 중복 방지 기록 리셋)

Railway Cron Schedule (UTC): 0 15 L * *   ← 한국 시간 다음 달 1일 00:00
(Railway cron 표현식 자체는 UTC이므로 그대로 두어야 한다.)

결산 대상 달은 실행 시점의 '전월'로 명시 계산한다.
예전에는 서버 OS가 UTC라 date.today()가 전달 말일이 되는 것에 기대고 있었는데,
TIME_ZONE을 Asia/Seoul로 통일하면서 그 우연이 성립하지 않으므로 직접 계산한다.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.users.models import User, ScoreHistory, MonthlyWinner


EXCLUDED_NICKNAMES = {"wldud", "김만덕", "김승혁", "도도도", "leewise", "농진", "23", "몽당연필", "에사비", "애사비"}


class Command(BaseCommand):
    help = "매월 점수 초기화 및 우수 활동자 기록"

    def handle(self, *args, **options):
        # 한국 기준 1일 00:00에 실행되므로, 결산 대상은 직전 달이다.
        today = timezone.localdate()
        last_month_end = today.replace(day=1) - timedelta(days=1)
        year = last_month_end.year
        month = last_month_end.month

        past_winner_ids = set(
            MonthlyWinner.objects.values_list("user_id", flat=True)
        )

        base_qs = (
            User.objects
            .exclude(nickname__in=EXCLUDED_NICKNAMES)
            .exclude(is_staff=True)
            .exclude(id__in=past_winner_ids)
            .filter(user_type="student", score__gt=0)
            .order_by("-score")
        )

        grade_groups = [
            ("1", base_qs.filter(grade=1)),
            ("2", base_qs.filter(grade=2)),
            ("34", base_qs.filter(Q(grade=3) | Q(grade=4))),
        ]

        winners_saved = 0
        for group_label, qs in grade_groups:
            winner = qs.first()
            if winner:
                MonthlyWinner.objects.update_or_create(
                    year=year,
                    month=month,
                    grade_group=group_label,
                    defaults={
                        "user": winner,
                        "score": winner.score,
                    },
                )
                winners_saved += 1
                self.stdout.write(
                    f"  {group_label}학년 우수자: "
                    f"{winner.nickname} ({winner.score}점)"
                )

        # 전체 점수 초기화
        reset_count = User.objects.filter(score__gt=0).update(score=0)
        ScoreHistory.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"완료 — 수상자 {winners_saved}명 저장, {reset_count}명 점수 초기화"
            )
        )
