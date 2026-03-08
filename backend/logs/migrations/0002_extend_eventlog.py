from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("logs", "0001_initial"),
    ]

    operations = [
        # author 집계 필드 (히트맵용)
        migrations.AddField(
            model_name="eventlog",
            name="author_user_type",
            field=models.CharField(
                blank=True, max_length=20, null=True, verbose_name="작성자 유형"
            ),
        ),
        migrations.AddField(
            model_name="eventlog",
            name="author_grade_at_event",
            field=models.PositiveSmallIntegerField(
                blank=True, null=True, verbose_name="작성자 학년"
            ),
        ),
        # 검색어 필드
        migrations.AddField(
            model_name="eventlog",
            name="search_keyword",
            field=models.CharField(
                blank=True, max_length=100, null=True, verbose_name="검색어"
            ),
        ),
        # grade_at_event 타입 변경 (Int → PositiveSmallInt)
        migrations.AlterField(
            model_name="eventlog",
            name="grade_at_event",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        # event_type choices 에 search 추가
        migrations.AlterField(
            model_name="eventlog",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("page_view", "페이지 방문"),
                    ("post_view", "게시글 조회"),
                    ("like", "좋아요"),
                    ("comment", "댓글 작성"),
                    ("signup", "회원가입"),
                    ("login", "로그인"),
                    ("search", "검색"),
                ],
                max_length=30,
            ),
        ),
        # 인덱스 추가
        migrations.AddIndex(
            model_name="eventlog",
            index=models.Index(
                fields=["event_type", "created_at"],
                name="logs_event_type_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="eventlog",
            index=models.Index(
                fields=["section", "created_at"],
                name="logs_section_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="eventlog",
            index=models.Index(
                fields=["post_id", "event_type"],
                name="logs_post_event_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="eventlog",
            index=models.Index(
                fields=["grade_at_event", "author_grade_at_event"],
                name="logs_grade_heatmap_idx",
            ),
        ),
    ]
