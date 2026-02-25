from .models import EventLog


def create_event_log(
    *,
    event_type: str,
    section: str | None = None,
    page: str | None = None,
    post_id: int | None = None,
    user_type: str | None = None,
    grade_at_event: int | None = None,
    utm_source: str | None = None,
):
    """
    개인 식별 없이 집계용 이벤트 로그 저장
    """
    return EventLog.objects.create(
        event_type=event_type,
        section=section,
        page=page,
        post_id=post_id,
        user_type=user_type,
        grade_at_event=grade_at_event,
        utm_source=utm_source,
    )