"""커뮤니티 업로드 이미지 정규화 테스트 (apps/common/images.py, normalize_post_images)."""
import shutil
import tempfile
from io import BytesIO, StringIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.common.images import MAX_IMAGE_SIDE, normalize_image
from apps.community.models import Category, Post, PostFile

User = get_user_model()

TEMP_MEDIA = tempfile.mkdtemp()


def image_bytes(size, fmt="JPEG", mode="RGB", **save_kwargs):
    buffer = BytesIO()
    Image.new(mode, size, "red").save(buffer, format=fmt, **save_kwargs)
    return buffer.getvalue()


def open_saved(field_file):
    with field_file.open("rb") as f, Image.open(f) as image:
        image.load()
        return image


class NormalizeImageTests(TestCase):
    def test_heic_becomes_jpeg(self):
        upload = SimpleUploadedFile("IMG_0001.HEIC", image_bytes((640, 480), fmt="HEIF"))
        result = normalize_image(upload)

        self.assertEqual(result.name, "IMG_0001.jpg")
        with Image.open(result) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (640, 480))

    def test_large_photo_is_resized(self):
        upload = SimpleUploadedFile("big.jpg", image_bytes((5712, 4284)))
        with Image.open(normalize_image(upload)) as image:
            self.assertEqual(max(image.size), MAX_IMAGE_SIDE)

    def test_exif_rotation_is_applied(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # 90도 회전해서 봐야 하는 세로 사진
        upload = SimpleUploadedFile("portrait.jpg", image_bytes((400, 200), exif=exif))

        with Image.open(normalize_image(upload)) as image:
            self.assertEqual(image.size, (200, 400))
            self.assertIsNone(image.getexif().get(0x0112))

    def test_transparent_png_stays_png(self):
        upload = SimpleUploadedFile("logo.png", image_bytes((100, 100), fmt="PNG", mode="RGBA"))
        result = normalize_image(upload)

        self.assertEqual(result.name, "logo.png")
        with Image.open(result) as image:
            self.assertEqual(image.mode, "RGBA")

    def test_not_an_image_is_rejected(self):
        upload = SimpleUploadedFile("fake.jpg", b"not an image")
        with self.assertRaises(ValidationError):
            normalize_image(upload)


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class CommunityUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user(
            email="writer@kookmin.ac.kr", nickname="writer", password="pw-test-1234"
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name="기타", slug="img-etc", group="community")

    def create_post(self, files, **extra):
        data = {
            "title": "사진",
            "content": "본문",
            "category": self.category.id,
            "new_files": files,
            **extra,
        }
        return self.client.post("/api/community/posts/", data, format="multipart")

    def test_heic_and_large_photo_are_stored_as_jpeg(self):
        response = self.create_post(
            [
                SimpleUploadedFile("IMG_6258.HEIC", image_bytes((640, 480), fmt="HEIF")),
                SimpleUploadedFile("big.jpeg", image_bytes((5712, 4284)), content_type="image/jpeg"),
            ],
            thumbnail_index=0,
        )
        self.assertEqual(response.status_code, 201, response.content)

        post = Post.objects.get(title="사진")
        files = list(post.files.order_by("order"))
        self.assertEqual([f.file_type for f in files], ["image", "image"])
        for post_file in files:
            self.assertTrue(post_file.file.name.endswith(".jpg"), post_file.file.name)
            self.assertLessEqual(max(open_saved(post_file.file).size), MAX_IMAGE_SIDE)
        self.assertEqual(post.thumbnail.name, files[0].file.name)

    def test_pdf_is_kept(self):
        pdf = SimpleUploadedFile("doc.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        response = self.create_post([pdf])

        self.assertEqual(response.status_code, 201, response.content)
        post_file = Post.objects.get(title="사진").files.get()
        self.assertEqual(post_file.file_type, "pdf")
        self.assertTrue(post_file.file.name.endswith(".pdf"))

    def edit_post(self, post, data):
        return self.client.patch(
            f"/api/community/posts/{post.id}/", data, format="multipart"
        )

    def create_post_with_files(self):
        response = self.create_post(
            [
                SimpleUploadedFile("a.jpg", image_bytes((100, 100)), content_type="image/jpeg"),
                SimpleUploadedFile("b.jpg", image_bytes((100, 100)), content_type="image/jpeg"),
                SimpleUploadedFile("doc.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
            ],
            thumbnail_index=1,
        )
        self.assertEqual(response.status_code, 201, response.content)
        post = Post.objects.get(title="사진")
        a, b, pdf = post.files.order_by("order")
        return post, a, b, pdf

    def test_edit_removes_and_adds_files(self):
        post, a, b, pdf = self.create_post_with_files()

        response = self.edit_post(
            post,
            {
                "existing_files": [a.id, pdf.id],
                "new_files": [
                    SimpleUploadedFile("IMG_1.HEIC", image_bytes((640, 480), fmt="HEIF"))
                ],
                # 남은 이미지 a, 새 이미지 중 두 번째(새 이미지)를 대표로
                "thumbnail_index": 1,
            },
        )
        self.assertEqual(response.status_code, 200, response.content)

        files = list(post.files.order_by("order"))
        self.assertEqual([f.id for f in files[:2]], [a.id, pdf.id])
        self.assertFalse(PostFile.objects.filter(id=b.id).exists())
        new_file = files[2]
        self.assertTrue(new_file.file.name.endswith(".jpg"))
        self.assertGreater(new_file.order, pdf.order)
        post.refresh_from_db()
        self.assertEqual(post.thumbnail.name, new_file.file.name)

    def test_edit_without_files_keeps_files_and_thumbnail(self):
        post, a, b, pdf = self.create_post_with_files()

        response = self.edit_post(post, {"title": "제목만 수정"})

        self.assertEqual(response.status_code, 200, response.content)
        post.refresh_from_db()
        self.assertEqual(post.title, "제목만 수정")
        self.assertEqual(post.files.count(), 3)
        self.assertEqual(post.thumbnail.name, b.file.name)

    def test_edit_deleting_main_image_falls_back_to_first(self):
        post, a, b, pdf = self.create_post_with_files()

        self.edit_post(post, {"existing_files": [a.id, pdf.id]})

        post.refresh_from_db()
        self.assertEqual(post.thumbnail.name, a.file.name)

    def test_edit_clear_files_removes_all(self):
        post, *_ = self.create_post_with_files()

        response = self.edit_post(post, {"clear_files": "true"})

        self.assertEqual(response.status_code, 200, response.content)
        post.refresh_from_db()
        self.assertEqual(post.files.count(), 0)
        self.assertFalse(post.thumbnail)

    def test_list_thumbnail_follows_main_image(self):
        post, a, b, pdf = self.create_post_with_files()

        response = self.client.get("/api/community/posts/")

        listed = next(p for p in response.json()["results"]["posts"] if p["id"] == post.id)
        self.assertTrue(listed["thumbnail"].endswith(b.file.name))

    def test_edit_cannot_pin_post(self):
        post, *_ = self.create_post_with_files()

        self.edit_post(post, {"is_pinned": "true"})

        post.refresh_from_db()
        self.assertFalse(post.is_pinned)

    def test_other_user_cannot_edit(self):
        post, *_ = self.create_post_with_files()
        other = User.objects.create_user(
            email="other@kookmin.ac.kr", nickname="other", password="pw-test-1234"
        )
        self.client.force_authenticate(user=other)

        response = self.edit_post(post, {"clear_files": "true"})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(post.files.count(), 3)

    def test_disallowed_file_is_rejected(self):
        response = self.create_post([SimpleUploadedFile("run.exe", b"MZ")])

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Post.objects.filter(title="사진").exists())


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class NormalizePostImagesCommandTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            email="old@kookmin.ac.kr", nickname="old", password="pw-test-1234"
        )
        self.post = Post.objects.create(author=user, title="예전 글", content="본문")

    def add_raw_file(self, name, data):
        # 변환 로직이 없던 시절처럼 원본 그대로 저장
        return PostFile.objects.create(
            post=self.post, file=SimpleUploadedFile(name, data), file_type="image"
        )

    def test_dry_run_changes_nothing(self):
        big = self.add_raw_file("IMG_6258.jpeg", image_bytes((5712, 4284)))
        original_name = big.file.name
        out = StringIO()

        call_command("normalize_post_images", stdout=out)

        big.refresh_from_db()
        self.assertEqual(big.file.name, original_name)
        self.assertIn("변환 대상 1개", out.getvalue())

    def test_apply_converts_only_problem_images(self):
        big = self.add_raw_file("IMG_6258.jpeg", image_bytes((5712, 4284)))
        heic = self.add_raw_file("IMG_7000.HEIC", image_bytes((640, 480), fmt="HEIF"))
        small = self.add_raw_file("small.jpg", image_bytes((1080, 1350)))
        self.post.thumbnail = big.file.name
        self.post.save(update_fields=["thumbnail"])
        small_name = small.file.name

        call_command("normalize_post_images", "--apply", stdout=StringIO())

        for post_file in (big, heic, small):
            post_file.refresh_from_db()
        self.post.refresh_from_db()

        self.assertTrue(big.file.name.endswith(".jpg"))
        self.assertEqual(max(open_saved(big.file).size), MAX_IMAGE_SIDE)
        self.assertEqual(open_saved(heic.file).format, "JPEG")
        self.assertEqual(small.file.name, small_name)
        self.assertEqual(self.post.thumbnail.name, big.file.name)
