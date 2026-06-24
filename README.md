# AIVE

> 국민대학교 AI빅데이터융합경영학과 학생들을 위한 학과 커뮤니티 플랫폼

AIVE는 학과 학생들이 수업 후기, 진로 정보, 대외활동 경험, 학과 생활 정보를 공유하고 탐색할 수 있는 학과 전용 커뮤니티 서비스입니다.

---

## 🔗 Service

- 서비스 URL: https://aive.vercel.app
- 대상 사용자: 국민대학교 AI빅데이터융합경영학과 재학생 및 관련 구성원

---

## 📌 프로젝트 개요

학과 정보는 에브리타임, 카카오톡, 인스타그램, 개인 네트워크 등에 흩어져 있어 필요한 정보를 찾기 어렵습니다.

AIVE는 이러한 문제를 해결하기 위해 학과 구성원들이 직접 경험을 기록하고, 필요한 정보를 쉽게 탐색하며, 선후배 간 정보를 공유할 수 있는 공간을 제공하는 것을 목표로 합니다.

---

## 🧩 주요 기능

- 카카오 로그인
- 사용자 온보딩
- 학과 인증 및 사용자 상태 관리
- 네트워크 게시판
- 커뮤니티 게시판
- 게시글 작성, 조회, 댓글, 좋아요
- 관리자 기능
- 사용자 행동 로그 수집
- GA4 기반 서비스 분석

---

## 🛠 기술 스택

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Kakao JavaScript SDK

### Backend

- Django
- Django REST Framework
- PostgreSQL
- Simple JWT

### Deploy & Infra

- Vercel
- Railway
- Cloudflare
- GitHub

### Analytics

- Google Analytics 4
- Custom Event Logging

---

## 📁 Repository Structure

```text
ABM_project/
├── frontend/        # 프론트엔드 Next.js
├── backend/         # 백엔드 Django
├── .github/         # GitHub 템플릿 및 워크플로우
├── .gitignore
└── README.md
