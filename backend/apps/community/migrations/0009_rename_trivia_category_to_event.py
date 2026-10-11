from django.db import migrations


def rename_trivia_category_to_event(apps, schema_editor):
    Category = apps.get_model("community", "Category")
    Category.objects.using(schema_editor.connection.alias).filter(
        group="community",
        name__in=["알쓸잡생", "알쓸생잡"],
    ).update(name="이벤트")


class Migration(migrations.Migration):
    dependencies = [
        ("community", "0008_comment_is_anonymous"),
    ]

    operations = [
        migrations.RunPython(
            rename_trivia_category_to_event,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
