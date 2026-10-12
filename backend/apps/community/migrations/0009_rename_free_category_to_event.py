from django.db import migrations

# 커뮤니티 "알쓸잡생" 카테고리를 "이벤트"로 바꾼다.
# 글쓰기 종류 선택·글 상세 배지·홈 카드가 모두 DB 이름을 그대로 보여주므로 이름만 바꾸면 된다.
# slug(free)는 필터 요청 값이라 그대로 둔다. 기존 알쓸잡생 글도 이벤트로 표시된다.
OLD_NAME = "알쓸잡생"
NEW_NAME = "이벤트"


def rename_to_event(apps, schema_editor):
    Category = apps.get_model("community", "Category")
    Category.objects.filter(slug="free", group="community").update(name=NEW_NAME)


def reverse_rename(apps, schema_editor):
    Category = apps.get_model("community", "Category")
    Category.objects.filter(slug="free", group="community").update(name=OLD_NAME)


class Migration(migrations.Migration):

    dependencies = [
        ("community", "0008_comment_is_anonymous"),
    ]

    operations = [
        migrations.RunPython(rename_to_event, reverse_rename),
    ]
