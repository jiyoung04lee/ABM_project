from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logs', '0007_add_session_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='apierrorlog',
            name='response_time_ms',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='응답시간(ms)',
            ),
        ),
    ]
