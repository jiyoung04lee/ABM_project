"""
이미 올라간 커뮤니티 이미지 중 브라우저가 못 그리는 것(HEIC, 긴 변 2048px 초과)을 변환한다.

    python manage.py normalize_post_images           # 변환 대상만 출력 (아무것도 바꾸지 않음)
    python manage.py normalize_post_images --apply   # 실제로 변환

변환한 이미지는 새 파일로 저장하고 DB가 새 파일을 가리키게 한다.
원본 파일은 지우지 않는다.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image

from apps.common.images import needs_normalization, normalize_image
from apps.community.models import PostFile


class Command(BaseCommand):
    help = "HEIC·초고해상도 커뮤니티 이미지를 브라우저 호환 JPEG/PNG로 변환합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="실제로 변환합니다. 없으면 대상만 출력합니다.",
        )

    def handle(self, *args, **options):
        apply = options["apply"]
        queryset = PostFile.objects.filter(file_type="image").select_related("post")

        found = converted = failed = 0
        for post_file in queryset.iterator():
            try:
                reason = self._reason(post_file)
            except Exception as exc:
                self.stderr.write(
                    f"post={post_file.post_id} {post_file.file.name}: 읽기 실패 ({exc})"
                )
                continue
            if reason is None:
                continue

            found += 1
            self.stdout.write(f"post={post_file.post_id} {post_file.file.name} ({reason})")
            if not apply:
                continue

            try:
                new_name = self._convert(post_file)
            except Exception as exc:
                failed += 1
                self.stderr.write(f"  → 변환 실패: {exc}")
            else:
                converted += 1
                self.stdout.write(f"  → {new_name}")

        if apply:
            self.stdout.write(
                self.style.SUCCESS(f"대상 {found}개 중 {converted}개 변환, {failed}개 실패")
            )
        else:
            self.stdout.write(
                f"변환 대상 {found}개. 실제로 변환하려면 --apply를 붙여 실행하세요."
            )

    def _reason(self, post_file):
        with post_file.file.open("rb") as f, Image.open(f) as image:
            if not needs_normalization(image):
                return None
            width, height = image.size
            return f"{image.format} {width}x{height}"

    def _convert(self, post_file):
        post = post_file.post
        old_name = post_file.file.name

        with post_file.file.open("rb") as f:
            content = normalize_image(f)

        with transaction.atomic():
            # file_overwrite=False라 같은 이름이 있으면 새 이름으로 저장된다 (원본 보존)
            post_file.file.save(content.name, content, save=False)
            post_file.save(update_fields=["file"])

            # 대표 이미지(상세 페이지)는 첨부파일과 같은 파일을 가리킨다
            if post.thumbnail and post.thumbnail.name == old_name:
                post.thumbnail.name = post_file.file.name
                # updated_at(auto_now)은 건드리지 않는다
                post.save(update_fields=["thumbnail"])

        return post_file.file.name
