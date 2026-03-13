from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0011_add_multi_major_and_student_registry"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="primary_major",
            field=models.CharField(
                blank=True,
                max_length=100,
                null=True,
                verbose_name="1전공 학과명",
            ),
        ),
    ]
