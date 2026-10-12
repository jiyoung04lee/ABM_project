"""
업로드 이미지 정규화.

사용자가 올린 사진을 어느 브라우저에서나 그릴 수 있는 형태로 바꿔 저장한다.
- HEIC/HEIF(아이폰 원본)는 크롬·파이어폭스가 표시하지 못한다 → JPEG로 변환
- 2000만 화소가 넘는 휴대폰 원본은 모바일 브라우저가 그리지 못하고 용량도 크다 → 긴 변을 줄임
- EXIF 회전 정보는 픽셀에 반영하고, 위치 정보가 들어 있는 EXIF는 저장하지 않는다
"""

from __future__ import annotations

import os
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from rest_framework.exceptions import ValidationError

# Image.open()이 HEIC/HEIF도 읽도록 등록
register_heif_opener()

MAX_IMAGE_SIDE = 2048
JPEG_QUALITY = 85

# 서버에서 줄여 저장하므로 원본은 휴대폰 사진 크기까지 받아준다
IMAGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024
PDF_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
PDF_EXTENSIONS = {".pdf"}


def _ext(file) -> str:
    return os.path.splitext(getattr(file, "name", "") or "")[1].lower()


def is_image_file(file) -> bool:
    """확장자로 이미지 여부를 판단한다. HEIC는 브라우저가 content_type을 비워 보내기도 한다."""
    return _ext(file) in IMAGE_EXTENSIONS


def needs_normalization(image: Image.Image) -> bool:
    """이미 저장된 이미지가 변환 대상인지 (HEIC이거나 긴 변이 너무 길면)."""
    return image.format == "HEIF" or max(image.size) > MAX_IMAGE_SIDE


def normalize_image(file, max_side: int = MAX_IMAGE_SIDE) -> ContentFile:
    """
    이미지를 브라우저 호환 파일(ContentFile)로 바꿔 반환한다.
    PNG·투명 배경은 PNG로, 나머지는 JPEG로 저장한다.
    읽을 수 없는 파일이면 ValidationError.
    """
    try:
        file.seek(0)
    except (AttributeError, OSError):
        pass

    # 원본 크기 사본이 여러 장 생기지 않게: 회전은 제자리에서, 줄인 다음에 색 변환
    try:
        with Image.open(file) as image:
            source_format = image.format
            # JPEG는 디코딩 단계에서 미리 줄여 큰 원본의 메모리 사용을 낮춘다
            image.draft("RGB", (max_side, max_side))
            icc_profile = image.info.get("icc_profile")
            ImageOps.exif_transpose(image, in_place=True)
            image.thumbnail((max_side, max_side), Image.LANCZOS)

            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            if source_format == "PNG" or has_alpha:
                target_mode = "RGBA" if has_alpha else "RGB"
                save_format, ext = "PNG", ".png"
                save_kwargs = {"optimize": True}
            else:
                target_mode = "RGB"
                save_format, ext = "JPEG", ".jpg"
                save_kwargs = {"quality": JPEG_QUALITY, "optimize": True, "progressive": True}
            if image.mode != target_mode:
                image = image.convert(target_mode)
            else:
                image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError("이미지 파일을 읽을 수 없습니다.") from exc

    # 아이폰 사진은 Display P3라 색 프로파일을 빼면 색이 바랜다
    if icc_profile:
        save_kwargs["icc_profile"] = icc_profile

    buffer = BytesIO()
    image.save(buffer, format=save_format, **save_kwargs)

    base_name = os.path.splitext(os.path.basename(getattr(file, "name", "") or "image"))[0]
    return ContentFile(buffer.getvalue(), name=f"{base_name or 'image'}{ext}")


def prepare_image_upload(file, max_side: int = MAX_IMAGE_SIDE):
    """업로드 이미지 하나를 검증하고 저장할 파일을 돌려준다. GIF는 애니메이션 유지를 위해 그대로 둔다."""
    if not is_image_file(file):
        raise ValidationError("허용되지 않은 이미지 형식입니다.")
    if file.size > IMAGE_MAX_UPLOAD_BYTES:
        raise ValidationError("이미지 파일은 20MB 이하만 가능합니다.")

    if _ext(file) == ".gif":
        try:
            with Image.open(file) as image:
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise ValidationError("이미지 파일을 읽을 수 없습니다.") from exc
        file.seek(0)
        return file

    return normalize_image(file, max_side=max_side)


def prepare_post_files(files):
    """게시글 첨부파일 목록 검증 + 이미지 변환. PDF는 그대로 둔다."""
    prepared = []
    for file in files:
        ext = _ext(file)
        if ext in IMAGE_EXTENSIONS:
            prepared.append(prepare_image_upload(file))
        elif ext in PDF_EXTENSIONS:
            if getattr(file, "content_type", "") != "application/pdf":
                raise ValidationError("잘못된 PDF 파일입니다.")
            if file.size > PDF_MAX_UPLOAD_BYTES:
                raise ValidationError("PDF 파일은 10MB 이하만 가능합니다.")
            prepared.append(file)
        else:
            raise ValidationError("허용되지 않은 파일 형식입니다.")
    return prepared
