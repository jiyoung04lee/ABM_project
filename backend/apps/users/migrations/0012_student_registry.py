from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0011_add_multi_major_fields"),
    ]

    operations = [
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
