import { getImageProps } from "next/image";
import { cn } from "cn";

/**
 * 장면 일러스트(DESIGN.md §8) - 두 사람(주황 = 곧게 선 H, 인디고 = 기댄 K)이
 * 붉은 실로 이어진 한 벌의 그림만 쓴다. 감정적 순간(첫 화면, 연결, 빈 상태)에만
 * 놓고 UI 크롬에는 쓰지 않는다. 밤 그림이 있으면 다크 모드에서 <picture>로
 * 바꿔 내보내 한쪽만 내려받는다. 원본은 docs/design-research/2026-10-03-*.
 */
const SCENES = {
  together: { day: "together-day", night: "together-night", width: 1000, height: 750 },
  apart: { day: "apart-day", night: "apart-night", width: 1200, height: 630 },
  leaning: { day: "leaning-day", night: "leaning-night", width: 520, height: 620 },
} as const;

export type Scene = keyof typeof SCENES;

export function SceneIllustration({
  scene,
  sizes,
  priority,
  className,
}: {
  scene: Scene;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const { day, night, width, height } = SCENES[scene];
  const common = { alt: "", width, height, sizes, priority };
  const {
    props: { srcSet: daySrcSet, alt, ...rest },
  } = getImageProps({ ...common, src: `/illustrations/${day}.webp` });
  const nightSrcSet = night
    ? getImageProps({ ...common, src: `/illustrations/${night}.webp` }).props.srcSet
    : null;

  return (
    <picture>
      {nightSrcSet && (
        <source media="(prefers-color-scheme: dark)" srcSet={nightSrcSet} sizes={sizes} />
      )}
      <source srcSet={daySrcSet} sizes={sizes} />
      {/* 장식 그림이라 alt를 비운다 - 옆 문구가 같은 내용을 말한다. */}
      <img {...rest} alt={alt} aria-hidden="true" className={cn("h-auto w-full", className)} />
    </picture>
  );
}
