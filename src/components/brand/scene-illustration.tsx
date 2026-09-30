import { getImageProps } from "next/image";
import { cn } from "cn";

/**
 * 장면 일러스트(DESIGN.md §8) - 브랜드 에셋 한 벌(2026-10-04)의 그림만 쓴다.
 * 주황(ember)과 인디고(dusk) 두 사람, 둘을 잇는 붉은 실과 하트, 옅은 노을빛
 * 하늘. 감정적 순간(첫 화면, 연결, 빈 상태, 곧 만나요)에만 놓고 UI 크롬에는 쓰지
 * 않는다. 밤 그림이 있으면 다크 모드에서 <picture>로 바꿔 내보내 한쪽만
 * 내려받는다. 원본은 docs/design-research/2026-10-04-brand-assets/.
 */
type Art = { day: string; night?: string; width: number; height: number };

const SCENES = {
  together: { day: "together", width: 676, height: 316 },
  apart: { day: "apart", width: 522, height: 377 },
  leaning: { day: "leaning-day", night: "leaning-night", width: 520, height: 620 },
  meet: { day: "meet", width: 363, height: 299 },
} satisfies Record<string, Art>;

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
  const { day, night, width, height }: Art = SCENES[scene];
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
