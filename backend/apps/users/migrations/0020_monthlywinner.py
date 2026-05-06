from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0019_remove_user_name_encrypted_remove_user_name_hash_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="MonthlyWinner",
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
                ("year", models.IntegerField()),
                ("month", models.IntegerField()),
                (
                    "grade_group",
                    models.CharField(
                        choices=[("1", "1학년"), ("2", "2학년"), ("34", "3·4학년")],
                        max_length=5,
                    ),
                ),
                ("score", models.IntegerField(help_text="수상 시점 점수")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="monthly_wins",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-year", "-month"],
                "unique_together": {("year", "month", "grade_group")},
            },
        ),
    ]
