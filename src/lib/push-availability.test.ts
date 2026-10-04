import { describe, expect, it } from "vitest";
import { isIosDevice, pushAvailability, type PushEnv } from "./push-availability";

const web: PushEnv = {
  native: false,
  hasNotification: true,
  hasServiceWorker: true,
  permission: "default",
  ios: false,
  standalone: false,
};

describe("pushAvailability", () => {
  it("Android 앱은 네이티브 경로", () => {
    expect(pushAvailability({ ...web, native: true })).toBe("native");
  });

  it("브라우저 권한을 그대로 따른다", () => {
    expect(pushAvailability(web)).toBe("default");
    expect(pushAvailability({ ...web, permission: "granted" })).toBe("granted");
    expect(pushAvailability({ ...web, permission: "denied" })).toBe("denied");
  });

  it("아이폰 Safari(홈 화면 웹 앱이 아님)에는 알림 API가 없어 홈 화면 추가를 안내", () => {
    const safari = { ...web, ios: true, hasNotification: false, permission: null };
    expect(pushAvailability(safari)).toBe("homeScreen");
  });

  it("홈 화면 웹 앱으로 연 아이폰은 일반 브라우저처럼", () => {
    expect(pushAvailability({ ...web, ios: true, standalone: true })).toBe("default");
    // 홈 화면 웹 앱인데도 API가 없으면(iOS 16.4 미만) 더 안내할 것이 없다.
    const old = { ...web, ios: true, standalone: true, hasNotification: false, permission: null };
    expect(pushAvailability(old)).toBe("unsupported");
  });

  it("알림 API나 서비스워커가 없는 브라우저", () => {
    expect(pushAvailability({ ...web, hasServiceWorker: false })).toBe("unsupported");
    expect(pushAvailability({ ...web, hasNotification: false, permission: null })).toBe(
      "unsupported",
    );
  });
});

describe("isIosDevice", () => {
  it("아이폰·아이패드(데스크톱 모드 포함)를 가린다", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 15; Pixel 9)", 5)).toBe(false);
  });
});
