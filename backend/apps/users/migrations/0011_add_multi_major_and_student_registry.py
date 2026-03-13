from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0010_add_user_interests"),
    ]

    operations = [
        # 다부전공 관련 필드 추가
        migrations.AddField(
            model_name="user",
            name="is_multi_major",
            field=models.BooleanField(
                default=False,
                verbose_name="다부전공 여부",
            ),
        ),
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
        migrations.AddField(
            model_name="user",
            name="multi_major_approved",
            field=models.BooleanField(
                default=False,
                verbose_name="다부전공 승인 여부",
            ),
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

