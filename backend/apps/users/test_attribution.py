"""가입 유입 경로(첫 방문 기준) 추출·저장 테스트."""
from django.contrib.auth import get_user_model
from django.http import QueryDict
from django.test import TestCase

from .utils import apply_signup_attribution, extract_signup_attribution

User = get_user_model()


def make_user(nickname="attr-user"):
    return User.objects.create_user(
        email=f"{nickname}@kookmin.ac.kr",
        password="pw-test-1234",
        nickname=nickname,
    )


class ExtractSignupAttributionTests(TestCase):
    def test_json_attribution_object(self):
        """카카오 로그인 요청(JSON)의 attribution 객체."""
        data = {
            "code": "abc",
            "attribution": {
                "utm_source": "ig",
                "utm_medium": "social",
                "utm_campaign": "fall_recruit",
                "referrer_host": "L.Instagram.com",
                "landing_page": "/network/12",
            },
        }
        self.assertEqual(
            extract_signup_attribution(data),
            {
                "utm_source": "ig",
                "utm_medium": "social",
                "utm_campaign": "fall_recruit",
                "referrer_host": "l.instagram.com",
                "landing_page": "/network/12",
            },
        )

    def test_multipart_prefixed_fields(self):
        """온보딩 제출(multipart)의 attr_ 접두 필드."""
        data = QueryDict(mutable=True)
        data.update({"nickname": "x", "attr_utm_source": "qr", "attr_landing_page": "/"})
        self.assertEqual(
            extract_signup_attribution(data),
            {"utm_source": "qr", "landing_page": "/"},
        )

    def test_invalid_values_dropped(self):
        data = {
            "attribution": {
                "utm_source": "   ",
                "referrer_host": "https://evil.com/x",
                "landing_page": "https://evil.com",
                "utm_campaign": "c" * 500,
            }
        }
        self.assertEqual(
            extract_signup_attribution(data), {"utm_campaign": "c" * 100}
        )

    def test_missing(self):
        self.assertEqual(extract_signup_attribution({}), {})


class ApplySignupAttributionTests(TestCase):
    def test_sets_fields_on_first_time(self):
        user = make_user()
        fields = apply_signup_attribution(
            user, {"utm_source": "ig", "landing_page": "/network"}
        )
        user.save(update_fields=fields)
        user.refresh_from_db()
        self.assertEqual(user.signup_utm_source, "ig")
        self.assertEqual(user.signup_landing_page, "/network")
        self.assertEqual(user.signup_utm_campaign, "")

    def test_does_not_overwrite_first_touch(self):
        user = make_user()
        user.save(update_fields=apply_signup_attribution(user, {"utm_source": "ig"}))
        fields = apply_signup_attribution(
            user, {"utm_source": "qr", "utm_campaign": "later"}
        )
        self.assertEqual(fields, [])
        user.refresh_from_db()
        self.assertEqual(user.signup_utm_source, "ig")
        self.assertEqual(user.signup_utm_campaign, "")

    def test_empty_attribution(self):
        self.assertEqual(apply_signup_attribution(make_user(), {}), [])
