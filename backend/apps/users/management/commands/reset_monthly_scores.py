"""
매월 1일 00:00 KST 에 실행하는 점수 초기화 커맨드.

1. 학년 그룹별(1학년 / 2학년 / 3·4학년) 1위를 MonthlyWinner에 저장
2. 전체 User.score → 0
3. ScoreHistory 삭제 (좋아요 중복 방지 기록 리셋)

Railway Cron Schedule (UTC): 0 15 L * *   ← 한국 시간 다음 달 1일 00:00
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.users.models import User, ScoreHistory, MonthlyWinner


EXCLUDED_NICKNAMES = {"wldud", "김만덕", "김승혁", "도도도", "leewise", "농진", "23", "몽당연필", "에사비"}


class Command(BaseCommand):
    help = "매월 점수 초기화 및 우수 활동자 기록"

    def handle(self, *args, **options):
        today = date.today()
        # 이 커맨드는 "이번 달 결산"을 위한 것이므로,
        # 한국 기준 1일 00:00에 돌리면 전달 성적을 저장하는 셈.
        # (실제 실행 시점이 UTC 전날 15시이므로 today가 전달 말일)
        year = today.year
        month = today.month

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
