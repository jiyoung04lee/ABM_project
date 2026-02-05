# ABM Project


## 📌 프로젝트 개요

ABM Project는 하나의 GitHub Repository에서 **프론트엔드와 백엔드를 분리하여 관리하는 모노레포 구조**를 사용합니다.

* Frontend: 사용자 화면(UI) 및 UX 구현
* Backend: API, 비즈니스 로직, 데이터 관리

---

## 📂 Repository 구조

```
ABM_project/
├─ frontend/        # 프론트엔드 (Next.js)
├─ backend/         # 백엔드 (Django)
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  └─ PULL_REQUEST_TEMPLATE.md
├─ .gitignore
└─ README.md
```

---

## 🌿 Git Flow 전략

본 프로젝트는 Git Flow를 기반으로 브랜치를 운영합니다.

```
main   ← 배포 브랜치
  ↑
develop ← 기본 개발 브랜치 (default)
  ↑
feature/* ← 기능 / 페이지 단위 브랜치
```

### 브랜치 역할

* **main**: 배포 전용 브랜치 (직접 작업 ❌, PR로만 merge)
* **develop**: 개발 브랜치 (기본 브랜치)
* **feature/***: 이슈 단위 작업 브랜치

---

## 🌱 브랜치 네이밍 규칙

모든 기능 개발은 **Issue 기반 feature 브랜치**에서 진행합니다.

```
feature/{issue번호}-{fe|be}-{기능명}
```

### 예시

```
feature/12-fe-home
feature/18-be-user-api
```

---

## 📝 Issue 관리 규칙

* 모든 작업은 **Issue 생성 후 진행**합니다.
* Issue Template을 사용합니다.

  * Frontend Feature
  * Backend Feature
  * Bug
* Issue 제목 규칙:

  * `[FE] 기능명`
  * `[BE] 기능명`
  * `[BUG] 버그 내용`

---

## 🔀 Pull Request(PR) 규칙

* 모든 PR은 **develop 브랜치로 merge**합니다.
* main 브랜치는 배포 시에만 develop에서 merge합니다.
* PR 작성 시 **PR Template 필수 사용**

### PR 체크리스트

* 기능 정상 동작 확인
* 로컬 테스트 완료
* 불필요한 코드 제거
* 이슈 연결 (`close #이슈번호`)

---

## 👥 협업 규칙

* 작업 시작 전 항상 최신 develop 브랜치 pull
* 하나의 PR에는 **하나의 이슈만** 포함
* 큰 작업은 기능 단위로 나누어 Issue 생성

---
