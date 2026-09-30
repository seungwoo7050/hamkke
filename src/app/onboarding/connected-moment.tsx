"use client";

import { useTranslations } from "next-intl";
import { SceneIllustration } from "@/components/brand/scene-illustration";

// 실이 이어지는 선 - 왼쪽에서 와서 가운데에서 하트 고리를 만들고 오른쪽으로 간다.
export const THREAD_PATH =
  "M4 28C36 33 72 34 100 30C84 19 87 5 100 13C113 5 116 19 100 30C128 34 164 33 196 28";

/**
 * 연결이 끝난 순간(DESIGN.md §8) - 떨어져 있던 두 사람 그림 위로 나란히 앉은
 * 그림이 떠오르고, 그 아래 실이 하트를 그리며 이어진다. 두 그림의 비율이 달라
 * 위 그림은 배경색 위에 놓아 아래 그림을 가린다. 상태(연결됨)를 전하는 한 번짜리
 * 모션이라 끝나면 부모가 /home으로 보낸다. 움직임 줄이기 설정이면
 * 애니메이션 없이 결과만 보여 준다(globals.css).
 */
export function ConnectedMoment() {
  const t = useTranslations("onboarding");
  return (
    <div
      role="status"
      className="bg-background fixed inset-0 z-50 flex flex-col justify-center gap-6 px-6 py-16"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl">
        <SceneIllustration scene="apart" sizes="(min-width: 30rem) 28rem, 100vw" />
        <div className="connected-scene bg-background absolute inset-0 flex items-center">
          <SceneIllustration scene="together" sizes="(min-width: 30rem) 28rem, 100vw" />
        </div>
      </div>
      <svg viewBox="0 0 200 40" aria-hidden="true" className="w-full max-w-md">
        <path
          className="connected-thread"
          d={THREAD_PATH}
          pathLength={1}
          fill="none"
          stroke="var(--color-ember)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="connected-caption font-handwritten text-dusk-ink text-2xl">{t("connected")}</p>
    </div>
  );
}
