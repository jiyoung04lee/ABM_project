from rest_framework.test import APITestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from apps.community.models import Post

User = get_user_model()


class CommunityTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            email="test@test.com",
            nickname="tester",
            password="password123"
        )

        self.client.force_authenticate(user=self.user)

        self.post = Post.objects.create(
            author=self.user,
            title="테스트",
            content="내용"
        )

    def test_post_like(self):
        url = f"/api/community/posts/{self.post.id}/like/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["liked"], True)

    def test_post_list(self):
        url = "/api/community/posts/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)