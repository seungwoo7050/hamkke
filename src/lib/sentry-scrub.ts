import type { ErrorEvent } from "@sentry/nextjs";

// Sentry로 나가는 오류 이벤트에서 개인정보를 걷어 낸다(beforeSend). 서버·엣지·
// 브라우저가 같은 함수를 쓴다. 남기는 것은 오류 종류·스택·경로·사용자 id(무작위
// 문자열)·기기 정보 정도다 - 개인정보처리방침의 Sentry 항목과 맞춘다.
//
// - 이메일·이름·IP: user는 id만 남긴다. 문자열 안의 이메일은 가린다.
// - 메시지 본문·좌표·토큰·쿠키: extra·breadcrumb 데이터에서 이름이 이런 값을
//   가리키는 키는 통째로 지운다.
// - 요청: 쿠키·헤더(user-agent 빼고)·본문·쿼리 문자열을 지운다. 주소의 쿼리도 뗀다.

// 키 이름을 단어로 나눠(camelCase·snake_case) 하나라도 여기 있으면 지운다.
const SENSITIVE_WORDS = new Set([
  "email",
  "name",
  "content",
  "text",
  "body",
  "message",
  "caption",
  "label",
  "lat",
  "lng",
  "lon",
  "latitude",
  "longitude",
  "coords",
  "location",
  "token",
  "cookie",
  "cookies",
  "authorization",
  "secret",
  "password",
  "key",
  "ip",
  "invite",
]);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const REDACTED = "[걸러냄]";
const MAX_DEPTH = 6;

export function scrubString(value: string) {
  return stripQuery(value.replace(EMAIL, REDACTED));
}

// 주소의 쿼리(?token=… 등)를 뗀다. 주소가 아닌 문자열은 그대로.
function stripQuery(value: string) {
  return value.replace(/(https?:\/\/[^\s?#"']+|\/[^\s?#"']*)\?[^\s#"']*/g, "$1");
}

function scrubValue(value: unknown, depth: number, dropKeys = false): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1, dropKeys));
  if (dropKeys) return scrubObject(value as Record<string, unknown>, depth);
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, scrubValue(v, depth + 1, dropKeys)]),
  );
}

export function isSensitiveKey(key: string) {
  return key
    .split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/)
    .some((word) => SENSITIVE_WORDS.has(word.toLowerCase()));
}

function scrubObject(obj: Record<string, unknown>, depth = 0) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) continue;
    out[key] = scrubValue(value, depth + 1, true);
  }
  return out;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;

  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"];
    event.request = {
      method: event.request.method,
      url: event.request.url ? stripQuery(event.request.url) : undefined,
      headers: userAgent ? { "user-agent": userAgent } : undefined,
    };
  }

  if (event.message) event.message = scrubString(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
    // 스택 프레임의 지역 변수(vars)에는 입력값이 그대로 담길 수 있다.
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }

  if (event.extra) event.extra = scrubObject(event.extra);
  // contexts는 SDK가 채우는 기기·런타임 정보(os.name, browser.name 등)라 키로 지우지
  // 않고 문자열만 거른다.
  if (event.contexts) event.contexts = scrubValue(event.contexts, 0) as ErrorEvent["contexts"];
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message && scrubString(crumb.message),
      data: crumb.data && scrubObject(crumb.data),
    }));
  }
  return event;
}
