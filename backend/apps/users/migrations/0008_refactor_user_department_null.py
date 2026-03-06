# Generated manually for User model refactor (department null=True, social_provider choices)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_add_social_and_onboarding_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="department",
            field=models.CharField(
                blank=True,
                max_length=100,
                null=True,
                verbose_name="학과",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="social_provider",
            field=models.CharField(
                choices=[("email", "Email"), ("kakao", "Kakao")],
                default="email",
                max_length=20,
                verbose_name="소셜 제공자",
            ),
        ),
    ]
