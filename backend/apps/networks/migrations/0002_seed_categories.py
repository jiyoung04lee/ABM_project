from django.db import migrations


def seed_categories(apps, schema_editor):
  Category = apps.get_model("networks", "Category")

  data = [
    # 재학생 탭
    {"type": "student", "name": "인턴", "slug": "intern"},
    {"type": "student", "name": "대외활동/공모전", "slug": "contest"},
    {"type": "student", "name": "학교 프로그램", "slug": "program"},
    {"type": "student", "name": "전공(다부전공)", "slug": "major"},
    {"type": "student", "name": "국제교류", "slug": "exchange"},
    # 졸업생 탭
    {"type": "graduate", "name": "취업", "slug": "job"},
    {"type": "graduate", "name": "대학원", "slug": "grad-school"},
    {"type": "graduate", "name": "직무 알아보기", "slug": "job-info"},
    # Q&A 탭
    {"type": "qa", "name": "학습", "slug": "study"},
    {"type": "qa", "name": "진로", "slug": "career"},
    {"type": "qa", "name": "기타", "slug": "etc"},
  ]

  for item in data:
    Category.objects.get_or_create(
      type=item["type"],
      slug=item["slug"],
      defaults={"name": item["name"]},
    )


def unseed_categories(apps, schema_editor):
  Category = apps.get_model("networks", "Category")
  slugs = [
    "intern",
    "contest",
    "program",
    "major",
    "exchange",
    "job",
    "grad-school",
    "job-info",
    "study",
    "career",
    "etc",
  ]
  Category.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

  dependencies = [
    ("networks", "0001_initial"),
  ]

  operations = [
    migrations.RunPython(seed_categories, unseed_categories),
  ]

