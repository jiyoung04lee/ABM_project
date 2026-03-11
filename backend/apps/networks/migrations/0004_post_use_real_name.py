from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("networks", "0003_comment_is_anonymous"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="use_real_name",
            field=models.BooleanField(default=False),
        ),
    ]
