from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("networks", "0001_initial"),
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="network_post",
            field=models.ForeignKey(
                to="networks.post",
                on_delete=models.CASCADE,
                null=True,
                blank=True,
                related_name="notifications",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="network_comment",
            field=models.ForeignKey(
                to="networks.comment",
                on_delete=models.CASCADE,
                null=True,
                blank=True,
                related_name="notifications",
            ),
        ),
    ]

