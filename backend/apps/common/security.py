from __future__ import annotations

from urllib.parse import urlparse

import bleach


ALLOWED_HTML_TAGS = {
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "a",
    "img",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "hr",
    "link-card",
}

ALLOWED_HTML_PROTOCOLS = {"http", "https", "mailto"}


def _is_safe_url(value: str) -> bool:
    parsed = urlparse((value or "").strip())
    if not parsed.scheme:
        return True
    return parsed.scheme.lower() in ALLOWED_HTML_PROTOCOLS


def _is_allowed_attribute(tag: str, name: str, value: str) -> bool:
    if tag == "a":
        return name in {"href", "title", "target", "rel"} and (
            name != "href" or _is_safe_url(value)
        )
    if tag == "img":
        return name in {"src", "alt", "title", "width", "height"} and (
            name != "src" or _is_safe_url(value)
        )
    if tag == "link-card":
        return name == "url" and _is_safe_url(value)
    return False


def sanitize_html(value: str | None) -> str:
    """
    Sanitize rich text before persistence. This complements frontend DOMPurify
    and strips scriptable tags, event handlers, data attributes, and dangerous
    URL schemes.
    """
    if not value:
        return ""

    cleaned = bleach.clean(
        value,
        tags=ALLOWED_HTML_TAGS,
        attributes=_is_allowed_attribute,
        protocols=ALLOWED_HTML_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )

    return cleaned


def sanitize_url(value: str | None) -> str:
    if not value:
        return ""
    return value if _is_safe_url(value) else ""
