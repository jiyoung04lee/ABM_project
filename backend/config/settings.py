"""
Django settings for config project.

환경 변수: .env 파일 사용 (python-dotenv). 필수 항목은 .env.example 참고 후 .env에 설정.
"""

import os
from pathlib import Path
from datetime import timedelta

import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# .env 로드 (프로젝트 루트 = config의 parent = backend)
load_dotenv(BASE_DIR / ".env")

# SECRET_KEY / DEBUG / ALLOWED_HOSTS 는 반드시 .env 에서 로드 (fallback 없음)
# 개발 시: cp .env.example .env 후 필요 시 값 수정
SECRET_KEY = os.environ["SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "yes")
_allowed = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [x.strip() for x in _allowed.split(",") if x.strip()]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # third-party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_yasg",
    "storages",

    # local apps
    'apps.users',
    'logs',
    'apps.community',
    'apps.notifications',
    'apps.networks',
    'apps.direct_messages',
    'apps.announcements',
    'axes',
    'apps.admin_otp',  
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    'axes.middleware.AxesMiddleware', 
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "logs.middleware.ErrorLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# Railway Postgres 는 DATABASE_URL 환경변수를 자동 주입.
# 로컬 개발 시 DATABASE_URL 미설정이면 SQLite 사용.

_database_url = os.environ.get("DATABASE_URL")
if _database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            _database_url,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation.MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation.CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User Model
AUTH_USER_MODEL = "users.User"


# Storage backends (Static: whitenoise / Media: Cloudflare R2 or local)

_r2_bucket = os.environ.get("R2_BUCKET_NAME")

if _r2_bucket:
    # Cloudflare R2 (S3-compatible) — 미디어 파일 전용
    _r2_custom_domain = os.environ.get("R2_CUSTOM_DOMAIN", "")

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "bucket_name": _r2_bucket,
                "access_key": os.environ["R2_ACCESS_KEY_ID"],
                "secret_key": os.environ["R2_SECRET_ACCESS_KEY"],
                "endpoint_url": os.environ["R2_ENDPOINT_URL"],
                # R2 는 퍼블릭 버킷 사용 시 서명 URL 불필요
                "querystring_auth": False,
                "default_acl": None,
                "file_overwrite": False,
                "custom_domain": _r2_custom_domain or None,
            },
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

    MEDIA_URL = (
        f"https://{_r2_custom_domain}/"
        if _r2_custom_domain
        else f"{os.environ['R2_ENDPOINT_URL']}/{_r2_bucket}/"
    )
else:
    # 로컬 개발: 로컬 파일 시스템 사용
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"


# Throttling (rate limit)
# - auth: register, login, verify-email → 5/min per IP
# - password_reset: password-reset/request, password-reset/confirm → 3/min per IP
# - health, me: throttle 없음
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": "5/min",
        "password_reset": "3/min",
    },
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

# Simple JWT 설정
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": (
        "rest_framework_simplejwt.tokens.AccessToken",
    ),
    "TOKEN_TYPE_CLAIM": "token_type",
}

SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
        }
    }
}

# CORS: 환경변수 CORS_ALLOWED_ORIGINS 에 콤마 구분 도메인 목록 설정.
# 미설정 시 로컬 개발 도메인만 허용.
_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if _cors_env:
    CORS_ALLOWED_ORIGINS = [x.strip() for x in _cors_env.split(",") if x.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

# Kakao Login (code 교환용)
KAKAO_REST_API_KEY = os.environ.get("KAKAO_REST_API_KEY", "").strip()
KAKAO_CLIENT_SECRET = os.environ.get("KAKAO_CLIENT_SECRET", "").strip() 

# Railway 등 프록시 뒤에서 HTTPS 인식
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# 관리자 계정 보안 설정 
# ==================== 이메일 설정 ====================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 465          # 587 → 465 로 변경
EMAIL_USE_SSL = True      # TLS → SSL 로 변경
EMAIL_USE_TLS = False     # 이거 False로
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("EMAIL_HOST_USER", "")

# ==================== 보안 설정 ====================
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SESSION_COOKIE_AGE = 3600  # 세션 1시간 후 만료

# ==================== django-axes 설정 ====================
AXES_FAILURE_LIMIT = 5        # 5회 실패 시 잠금
AXES_COOLOFF_TIME = 1         # 1시간 후 잠금 해제
AXES_LOCKOUT_CALLABLE = None  # 기본 잠금 동작 사용
AXES_RESET_ON_SUCCESS = True  # 로그인 성공 시 실패 기록 초기화

# ==================== AUTHENTICATION BACKENDS ====================
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# OTP 설정
OTP_EXPIRY_SECONDS = 300 # 5분 후 만료 
# 이메일 타임아웃 설정
EMAIL_TIMEOUT = 10 

# ==================== 캐시 설정 ====================
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}