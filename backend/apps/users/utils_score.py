from django.db.models import F
from datetime import date
from apps.users.models import ScoreHistory, User

MAX_SCORE = 300


def add_score(user, point):

    if point > 0 and user.score >= MAX_SCORE:
        return

    User.objects.filter(id=user.id).update(score=F("score") + point)

    user.refresh_from_db(fields=["score"])

    if user.score > MAX_SCORE:
        user.score = MAX_SCORE
        user.save(update_fields=["score"])

    if user.score < 0:
        user.score = 0
        user.save(update_fields=["score"])


def give_login_point(user):

    today = date.today()

    if user.last_login_point_date != today:

        add_score(user, 1)

        user.last_login_point_date = today
        user.save(update_fields=["last_login_point_date"])


# 게시글 좋아요 점수 지급
def add_post_like_score(user, post_id):

    exists = ScoreHistory.objects.filter(
        user=user,
        score_type="post_like",
        target_id=post_id,
    ).exists()

    if exists:
        return

    ScoreHistory.objects.create(
        user=user,
        score_type="post_like",
        target_id=post_id,
    )

    add_score(user, 1)


# 게시글 좋아요 취소 시 점수 차감
def remove_post_like_score(user, post_id):

    deleted, _ = ScoreHistory.objects.filter(
        user=user,
        score_type="post_like",
        target_id=post_id,
    ).delete()

    if deleted:
        add_score(user, -1)


# 댓글 좋아요 점수 지급
def add_comment_like_score(user, comment_id):

    exists = ScoreHistory.objects.filter(
        user=user,
        score_type="comment_like",
        target_id=comment_id,
    ).exists()

    if exists:
        return

    ScoreHistory.objects.create(
        user=user,
        score_type="comment_like",
        target_id=comment_id,
    )

    add_score(user, 1)


# 댓글 좋아요 취소 시 점수 차감
def remove_comment_like_score(user, comment_id):

    deleted, _ = ScoreHistory.objects.filter(
        user=user,
        score_type="comment_like",
        target_id=comment_id,
    ).delete()

    if deleted:
        add_score(user, -1)