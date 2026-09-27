"""
분석 전용 읽기 뷰(analytics 스키마) 생성·갱신.

분석 agent(주간 브리핑·MCP)는 운영 DB를 읽기 전용 계정으로만 조회하고,
그 계정은 이 명령이 만드는 analytics 스키마의 뷰만 읽을 수 있다.
뷰에는 이름·이메일·학번·카카오ID·쪽지 내용이 없고, 익명 글·댓글의 작성자 ID는 비워 둔다.

배포 시 실행 순서 (railway.toml startCommand):
    python manage.py sync_analytics_views --drop   # 마이그레이션이 뷰 의존성에 막히지 않도록 먼저 제거
    python manage.py migrate
    python manage.py sync_analytics_views          # 최신 스키마 기준으로 다시 생성 + 권한 부여

읽기 전용 계정은 한 번만 직접 만든다:
    python manage.py sync_analytics_views --print-role-sql
출력된 SQL을 DB 관리자 계정으로 실행하고, 환경변수 ANALYTICS_READONLY_ROLE에 계정 이름을 넣어 두면
매 배포마다 이 명령이 뷰 권한을 다시 부여한다.

PostgreSQL이 아니면(로컬 SQLite 등) 아무것도 하지 않는다.
이 명령의 실패가 배포를 막지 않도록, 오류는 경고만 출력하고 정상 종료한다.
"""
import os
import re

from django.core.management.base import BaseCommand
from django.db import connection, transaction

SCHEMA = "analytics"
ROLE_ENV = "ANALYTICS_READONLY_ROLE"
# 다른 세션이 뷰를 잡고 있으면 오래 기다리지 않고 포기한다 (배포가 멈추지 않도록)
LOCK_TIMEOUT_SQL = "SET LOCAL lock_timeout = '5s'"
_ROLE_NAME_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")

# 익명 보호: 아래 규칙으로 "방문(세션) ↔ 회원 ID ↔ 익명 글" 이 시각으로 이어지지 않게 한다.
#   - 글 작성·댓글·좋아요·임시저장 이벤트는 session_id를 비운다
#   - 회원 ID가 붙은 행(회원·좋아요)과 익명 글·댓글의 시각은 날짜(KST)까지만 보여준다
# (로그인·가입 이벤트의 session_id는 가입 퍼널 분석에 필요해 남긴다)
SESSION_HIDDEN_EVENT_TYPES = ("post_create", "comment", "like", "draft_save")
_hidden_events_sql = ", ".join(f"'{e}'" for e in SESSION_HIDDEN_EVENT_TYPES)


def _kst_date(column: str) -> str:
    return f"CAST({column} AT TIME ZONE 'Asia/Seoul' AS DATE)"


# 뷰 이름 -> SELECT 본문. 새 뷰를 추가하면 --drop 대상에도 자동 포함된다.
VIEWS = {
    "users": f"""
        SELECT id, user_type, grade, admission_year, interests,
               is_multi_major, multi_major_approved, social_provider,
               is_profile_complete, is_verified, is_staff, is_active,
               {_kst_date("created_at")} AS created_date,
               {_kst_date("profile_completed_at")} AS profile_completed_date,
               {_kst_date("last_login")} AS last_login_date,
               score, last_login_point_date,
               signup_utm_source, signup_utm_medium, signup_utm_campaign,
               signup_referrer, signup_landing_page
        FROM public.users
    """,
    "event_log": f"""
        SELECT id, event_type, section, page, post_id,
               user_type, grade_at_event, author_user_type, author_grade_at_event,
               search_keyword, interest_at_event, utm_source,
               CASE WHEN event_type IN ({_hidden_events_sql}) THEN NULL
                    ELSE session_id END AS session_id,
               visitor_type, properties, created_at
        FROM public.logs_eventlog
    """,
    "daily_active_user": """
        SELECT id, user_id, date, created_at
        FROM public.logs_dailyactiveuser
    """,
    "community_category": """
        SELECT id, name, slug, "group"
        FROM public.community_category
    """,
    "community_post": f"""
        SELECT id, category_id,
               CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
               is_anonymous, title, view_count, like_count, comment_count,
               is_deleted, is_pinned,
               {_kst_date("created_at")} AS created_date,
               CASE WHEN is_anonymous THEN NULL ELSE created_at END AS created_at
        FROM public.community_post
    """,
    "community_comment": f"""
        SELECT id, post_id, parent_id,
               CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
               is_anonymous, is_deleted, like_count,
               {_kst_date("created_at")} AS created_date,
               CASE WHEN is_anonymous THEN NULL ELSE created_at END AS created_at
        FROM public.community_comment
    """,
    "community_reaction": f"""
        SELECT id, post_id, user_id, {_kst_date("created_at")} AS created_date
        FROM public.community_reaction
    """,
    "community_comment_reaction": f"""
        SELECT id, comment_id, user_id, {_kst_date("created_at")} AS created_date
        FROM public.community_commentreaction
    """,
    "network_category": """
        SELECT id, type, name, slug
        FROM public.networks_category
    """,
    "network_post": f"""
        SELECT id, type, category_id,
               CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
               is_anonymous, use_real_name, title, view_count, like_count,
               comment_count, is_deleted, is_pinned,
               {_kst_date("created_at")} AS created_date,
               CASE WHEN is_anonymous THEN NULL ELSE created_at END AS created_at
        FROM public.networks_post
    """,
    "network_comment": f"""
        SELECT id, post_id, parent_id,
               CASE WHEN is_anonymous THEN NULL ELSE author_id END AS author_id,
               is_anonymous, is_deleted, like_count,
               {_kst_date("created_at")} AS created_date,
               CASE WHEN is_anonymous THEN NULL ELSE created_at END AS created_at
        FROM public.networks_comment
    """,
    "network_reaction": f"""
        SELECT id, post_id, user_id, {_kst_date("created_at")} AS created_date
        FROM public.networks_reaction
    """,
    "network_comment_reaction": f"""
        SELECT id, comment_id, user_id, {_kst_date("created_at")} AS created_date
        FROM public.networks_commentreaction
    """,
    "network_draft": f"""
        SELECT id, author_id, type, {_kst_date("updated_at")} AS updated_date
        FROM public.networks_draft
    """,
}

ROLE_SQL_TEMPLATE = """\
-- 1회만 실행 (DB 관리자 계정). 비밀번호는 직접 정하고, 접속 주소는 채팅·코드에 남기지 마세요.
CREATE ROLE {role} WITH LOGIN PASSWORD '<직접 정한 강한 비밀번호>';
GRANT CONNECT ON DATABASE {database} TO {role};
ALTER ROLE {role} SET default_transaction_read_only = on;
-- 분석 쿼리가 오래 붙잡고 있어도 배포(뷰 재생성)를 막지 않도록
ALTER ROLE {role} SET statement_timeout = '30s';
ALTER ROLE {role} SET idle_in_transaction_session_timeout = '60s';
-- analytics 스키마 권한은 배포 때 sync_analytics_views가 매번 부여합니다.
-- Railway 환경변수: {role_env}={role}
"""


class Command(BaseCommand):
    help = "개인정보를 제외한 분석 전용 뷰(analytics 스키마)를 생성·갱신합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--drop",
            action="store_true",
            help="analytics 뷰를 모두 제거합니다 (마이그레이션 전에 실행).",
        )
        parser.add_argument(
            "--print-role-sql",
            action="store_true",
            help="읽기 전용 계정 생성 SQL을 출력합니다 (DB 변경 없음).",
        )

    def handle(self, *args, **options):
        if options["print_role_sql"]:
            self.stdout.write(
                ROLE_SQL_TEMPLATE.format(
                    role=self._role_name() or "aive_readonly",
                    database=connection.settings_dict.get("NAME") or "<database>",
                    role_env=ROLE_ENV,
                )
            )
            return

        if connection.vendor != "postgresql":
            self.stdout.write("PostgreSQL이 아니므로 analytics 뷰를 건너뜁니다.")
            return

        try:
            if options["drop"]:
                self._drop_views()
                self.stdout.write("analytics 뷰를 제거했습니다.")
            else:
                self._create_views()
                self.stdout.write(f"analytics 뷰 {len(VIEWS)}개를 갱신했습니다.")
        except Exception as exc:  # 배포를 막지 않는다
            self.stderr.write(f"[경고] analytics 뷰 처리 실패: {exc}")

    def _role_name(self) -> str | None:
        role = (os.environ.get(ROLE_ENV) or "").strip()
        return role if _ROLE_NAME_RE.match(role) else None

    def _drop_views(self):
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(LOCK_TIMEOUT_SQL)
            for name in VIEWS:
                cursor.execute(f"DROP VIEW IF EXISTS {SCHEMA}.{name}")

    def _create_views(self):
        # 전부 성공하거나 전부 이전 상태로 (중간 실패 시 일부 뷰만 사라지는 일 방지)
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(LOCK_TIMEOUT_SQL)
            cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
            for name, select_sql in VIEWS.items():
                # 컬럼 구성이 바뀌어도 교체되도록 매번 새로 만든다
                cursor.execute(f"DROP VIEW IF EXISTS {SCHEMA}.{name}")
                cursor.execute(f"CREATE VIEW {SCHEMA}.{name} AS {select_sql}")

            role = self._role_name()
            if not role:
                return
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [role])
            if cursor.fetchone() is None:
                self.stderr.write(f"[경고] 읽기 전용 계정 {role}이 없어 권한 부여를 건너뜁니다.")
                return
            cursor.execute(f"GRANT USAGE ON SCHEMA {SCHEMA} TO {role}")
            cursor.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA {SCHEMA} TO {role}")
