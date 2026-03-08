# Add User.interests for onboarding 관심분야 (AI / 데이터 / 경영)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0009_allow_email_nullable"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="interests",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="예: ['ai', 'data', 'business']",
                verbose_name="관심분야",
            ),
        ),
    ]
