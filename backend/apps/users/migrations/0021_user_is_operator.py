"""
운영진 플래그 도입 + 기존 닉네임 하드코딩 목록 이관.

기존에는 EXCLUDED_NICKNAMES가 apps/users/views.py와
management/commands/reset_monthly_scores.py 두 곳에 복사돼 있었고,
점수 랭킹에서만 쓰였다. 이제 User.is_operator로 옮기고
집계(DAU/재방문율/복귀 분석)에서도 함께 제외한다.

확인된 운영진(이름 → 닉네임):
    이지영 → wldud
    김승혁 → 김승혁
    윤성철 → 김만덕
    김아현 → 에사비 또는 애사비
    이도연 → 몽당연필
    문동혁 → 문동혁

도도도 / leewise / 농진 / 23 은 현재 소속이 확인되지 않았으나,
지금까지 랭킹에서 제외되어 온 계정이라 동작을 바꾸지 않기 위해 그대로 제외 유지한다.
해제는 관리자 페이지에서 체크박스로 하면 된다.
"""
from django.db import migrations, models

# 구 EXCLUDED_NICKNAMES (랭킹에서 이미 제외되던 계정) + 신규 확정 운영진
LEGACY_EXCLUDED_NICKNAMES = [
    "wldud",      # 이지영
    "김승혁",      # 김승혁
    "김만덕",      # 윤성철
    "몽당연필",    # 이도연
    "에사비",      # 김아현 (표기 흔들림이 있어 둘 다 포함)
    "애사비",      # 김아현
    "도도도",      # 소속 미확인 — 기존 동작 유지
    "leewise",    # 소속 미확인 — 기존 동작 유지
    "농진",        # 소속 미확인 — 기존 동작 유지
    "23",          # 소속 미확인 — 기존 동작 유지
]

# 기존 목록에 없던 신규 운영진 (닉네임 = 이름)
NEWLY_ADDED_NICKNAMES = [
    "문동혁",
]

ALL_OPERATOR_NICKNAMES = LEGACY_EXCLUDED_NICKNAMES + NEWLY_ADDED_NICKNAMES


def mark_operators(apps, schema_editor):
    User = apps.get_model("users", "User")

    updated = User.objects.filter(
        nickname__in=ALL_OPERATOR_NICKNAMES
    ).update(is_operator=True)

    # 닉네임이 바뀌었거나 오타로 남아 있던 항목은 아무도 잡지 못한다.
    # 조용히 넘어가면 예전과 똑같은 문제가 반복되므로 어떤 항목이 비었는지 알린다.
    found = set(
        User.objects.filter(
            nickname__in=ALL_OPERATOR_NICKNAMES
        ).values_list("nickname", flat=True)
    )
    missing = [n for n in ALL_OPERATOR_NICKNAMES if n not in found]

    print(f"\n  운영진 {updated}명 표시 완료")
    if missing:
        print(
            "  ⚠ 아래 닉네임은 해당 계정이 없어 표시되지 않았습니다. "
            "관리자 페이지에서 직접 지정해 주세요:"
        )
        for n in missing:
            print(f"      - {n}")


def unmark_operators(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(is_operator=True).update(is_operator=False)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0020_monthlywinner"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_operator",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "점수 랭킹, 월간 결산, DAU/재방문율/복귀 분석에서 "
                    "모두 제외됩니다."
                ),
                verbose_name="운영진(집계·랭킹 제외)",
            ),
        ),
        migrations.RunPython(mark_operators, unmark_operators),
    ]
