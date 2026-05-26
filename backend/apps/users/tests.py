from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.security import sanitize_html


User = get_user_model()


class RichTextSanitizeTests(TestCase):
    def test_sanitize_html_removes_scriptable_content(self):
        html = (
            '<p onclick="alert(1)">ok</p>'
            '<script>alert(1)</script>'
            '<iframe src="https://example.com"></iframe>'
            '<img src="javascript:alert(1)" onerror="alert(1)">'
        )

        cleaned = sanitize_html(html)

        self.assertIn("<p>ok</p>", cleaned)
        self.assertIn("<img>", cleaned)
        self.assertNotIn("<script", cleaned)
        self.assertNotIn("<iframe", cleaned)
        self.assertNotIn("onclick", cleaned)
        self.assertNotIn("onerror", cleaned)
        self.assertNotIn("javascript:", cleaned)

    def test_sanitize_html_preserves_safe_link_card_url(self):
        html = (
            '<link-card url="https://example.com/a"></link-card>'
            '<link-card url="javascript:alert(1)"></link-card>'
        )

        cleaned = sanitize_html(html)

        self.assertIn(
            '<link-card url="https://example.com/a"></link-card>',
            cleaned,
        )
        self.assertIn("<link-card></link-card>", cleaned)
        self.assertNotIn("javascript:", cleaned)


class AuthSecurityTests(APITestCase):
    def _create_user(self, **extra_fields):
        defaults = {
            "email": "user@example.com",
            "nickname": "tester",
            "password": "password12345",
            "name": "Tester",
            "is_verified": True,
            "is_profile_complete": True,
            "personal_info_consent": True,
        }
        defaults.update(extra_fields)
        return User.objects.create_user(**defaults)

    def test_pending_multi_major_user_is_treated_as_unauthenticated(self):
        user = self._create_user(
            is_multi_major=True,
            multi_major_approved=False,
        )
        access = RefreshToken.for_user(user).access_token

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/users/me/")

        self.assertIn(response.status_code, (401, 403))

    def test_staff_bypasses_pending_multi_major_auth_restriction(self):
        user = self._create_user(
            email="admin@example.com",
            nickname="admin",
            is_staff=True,
            is_multi_major=True,
            multi_major_approved=False,
        )
        access = RefreshToken.for_user(user).access_token

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_staff"])

    def test_token_refresh_rotates_token_and_sets_httponly_cookies(self):
        user = self._create_user()
        refresh = RefreshToken.for_user(user)

        response = self.client.post(
            "/api/users/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertTrue(response.cookies["access_token"]["httponly"])
        self.assertTrue(response.cookies["refresh_token"]["httponly"])
