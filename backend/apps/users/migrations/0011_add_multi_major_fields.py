from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0010_add_user_interests"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_multi_major",
            field=models.BooleanField(default=False, verbose_name="다부전공 여부"),
        ),
        migrations.AddField(
            model_name="user",
            name="multi_major_image",
            field=models.ImageField(
                upload_to="users/multi_major/",
                null=True,
                blank=True,
                verbose_name="다부전공 증빙 이미지",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="multi_major_approved",
            field=models.BooleanField(default=False, verbose_name="다부전공 승인 여부"),
        ),
    ]

