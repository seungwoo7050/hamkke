import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

// 홈 화면에 추가한 웹 앱(PWA)의 이름·아이콘·첫 화면. 아이폰은 홈 화면에 추가한
// 웹 앱에서만 웹 푸시를 받을 수 있어(iOS 16.4+) 웹 1차 배포의 알림이 여기에 기댄다.
// 이름은 요청한 사람의 언어로(언어별 URL이 없어 요청 쿠키·헤더로 정한다).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("meta");
  return {
    id: "/",
    name: t("title"),
    short_name: t("shortName"),
    description: t("description"),
    start_url: "/home",
    scope: "/",
    display: "standalone",
    // globals.css --background(zinc-50)와 앱 아이콘 배경(assets/brand/app-icon.svg)
    background_color: "#fafafa",
    theme_color: "#fafafa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
