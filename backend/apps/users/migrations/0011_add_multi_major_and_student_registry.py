from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0010_add_user_interests"),
    ]

    operations = [
        # 다부전공 관련 필드 추가
        # 기존 프로덕션 DB에는 is_multi_major 컬럼이 먼저 수동으로 생성되어 있을 수 있으므로
        # 컬럼 존재 여부에 따라 안전하게 동작하도록 RunSQL + SeparateDatabaseAndState 사용
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "users" '
                        'ADD COLUMN IF NOT EXISTS "is_multi_major" boolean '
                        'NOT NULL DEFAULT false;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "users" '
                        'DROP COLUMN IF EXISTS "is_multi_major";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="is_multi_major",
                    field=models.BooleanField(
                        default=False,
                        verbose_name="다부전공 여부",
                    ),
                ),
            ],
        ),
        # 프로덕션 DB에 이미 있을 수 있으므로 IF NOT EXISTS 사용
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "users" '
                        'ADD COLUMN IF NOT EXISTS "multi_major_image" varchar(100) NULL;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "users" '
                        'DROP COLUMN IF EXISTS "multi_major_image";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="multi_major_image",
                    field=models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="users/multi_major/",
                        verbose_name="다부전공 증빙 이미지",
                    ),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "users" '
                        'ADD COLUMN IF NOT EXISTS "multi_major_approved" boolean '
                        'NOT NULL DEFAULT false;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "users" '
                        'DROP COLUMN IF EXISTS "multi_major_approved";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="user",
                    name="multi_major_approved",
                    field=models.BooleanField(
                        default=False,
                        verbose_name="다부전공 승인 여부",
                    ),
                ),
            ],
        ),
        # 재학생 명단 테이블
        migrations.CreateModel(
            name="StudentRegistry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "student_id",
                    models.CharField(
                        max_length=8,
                        unique=True,
                        verbose_name="학번",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        max_length=50,
                        verbose_name="이름",
                    ),
                ),
            ],
            options={
                "verbose_name": "재학생 명부",
                "verbose_name_plural": "재학생 명부",
            },
        ),
    ]

