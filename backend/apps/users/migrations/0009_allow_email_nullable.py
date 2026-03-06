# Allow email to be null (optional for social users; can be set in onboarding)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_refactor_user_department_null"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                blank=True,
                max_length=254,
                null=True,
                unique=True,
                verbose_name="이메일",
            ),
        ),
    ]
