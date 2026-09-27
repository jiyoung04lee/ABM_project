// 방문 단위 세션 ID · 유입 정보(utm/referrer) · GTM dataLayer 전송.
// 분석 기준은 DB(EventLog)이고, dataLayer는 GA4 참고용이다.

const SESSION_ID_KEY = "aive_session_id";
// 이번 방문(탭 세션)의 유입 정보 — 세션 첫 페이지에서 한 번만 기록
const SESSION_TOUCH_KEY = "aive_session_touch";
// 첫 방문 유입 정보 — 가입 시 회원 정보에 저장 (90일 지나면 새로 기록)
const FIRST_TOUCH_KEY = "aive_first_touch";
const FIRST_TOUCH_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
// 카카오 로그인에서 돌아올 때의 referrer는 유입 경로가 아니다
const IGNORED_REFERRER_HOSTS = ["accounts.kakao.com", "kauth.kakao.com"];

export type Touch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer_host?: string;
  landing_page?: string;
};

type StoredFirstTouch = Touch & { captured_at: number };

type StorageKind = "session" | "local";

// 저장소 접근 자체가 예외를 던지는 환경(개인정보 보호 모드 등)이 있어 매번 try로 감싼다.
// 그런 환경에서는 추적만 빠지고 화면은 정상 동작한다.
function readJson<T>(kind: StorageKind, key: string): T | null {
  try {
    const storage = kind === "session" ? sessionStorage : localStorage;
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(kind: StorageKind, key: string, value: unknown) {
  try {
    const storage = kind === "session" ? sessionStorage : localStorage;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 무시
  }
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function currentTouch(): Touch {
  const params = new URLSearchParams(window.location.search);
  const touch: Touch = { landing_page: window.location.pathname };
  const source = params.get("utm_source");
  const medium = params.get("utm_medium");
  const campaign = params.get("utm_campaign");
  if (source) touch.utm_source = source;
  if (medium) touch.utm_medium = medium;
  if (campaign) touch.utm_campaign = campaign;
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).host;
      if (host && host !== window.location.host && !IGNORED_REFERRER_HOSTS.includes(host)) {
        touch.referrer_host = host;
      }
    }
  } catch {
    // referrer 형식 오류는 무시
  }
  return touch;
}

/** 페이지 진입마다 호출. 세션 첫 페이지·첫 방문의 유입 정보만 남긴다. */
export function captureTouch() {
  if (typeof window === "undefined") return;
  const touch = currentTouch();

  if (!readJson<Touch>("session", SESSION_TOUCH_KEY)) {
    writeJson("session", SESSION_TOUCH_KEY, touch);
  }

  const first = readJson<StoredFirstTouch>("local", FIRST_TOUCH_KEY);
  if (!first || Date.now() - first.captured_at > FIRST_TOUCH_MAX_AGE_MS) {
    writeJson("local", FIRST_TOUCH_KEY, { ...touch, captured_at: Date.now() });
  }
}

export function getSessionTouch(): Touch {
  if (typeof window === "undefined") return {};
  return readJson<Touch>("session", SESSION_TOUCH_KEY) ?? {};
}

/** 가입 유입 정보 (카카오 로그인·온보딩 제출에 함께 전송) */
export function getFirstTouch(): Touch {
  if (typeof window === "undefined") return {};
  const first = readJson<StoredFirstTouch>("local", FIRST_TOUCH_KEY);
  if (!first) return {};
  const { captured_at: _capturedAt, ...touch } = first;
  return touch;
}

/** GTM dataLayer 이벤트 (GA4 참고용). GTM에 같은 이름의 이벤트 태그를 설정해야 GA4로 전송된다. */
export function pushDataLayer(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
}
