import { cn } from "cn";
import { SceneIllustration } from "@/components/brand/scene-illustration";

// 빈 상태마다 놓을 그림 - 같은 한 벌(DESIGN.md §8)에서 그 자리의 말과 맞는 것만.
const ART = {
  // 휴대폰 너머로 실이 이어진 두 사람 - 아직 나눈 이야기가 없는 대화
  chat: { scene: "apart", width: "w-40", sizes: "10rem" },
  // 실로 이어진 지구 - 위치를 나누면 서로를 찾을 수 있다
  location: { scene: "globe", width: "w-24", sizes: "6rem" },
} as const;

/**
 * 빈 상태 화면 공통 컴포넌트(DESIGN.md §8) - 브랜드 에셋 한 벌의 그림 하나와
 * 캡션. 화면마다 새 그림을 그리지 않고 ART에서 고른다. 캡션은 감성 포인트 전용
 * Gaegu 폰트(`font-handwritten`)로만 표기한다.
 */
export function EmptyState({
  art,
  caption,
  className,
}: {
  art: keyof typeof ART;
  caption: string;
  className?: string;
}) {
  const { scene, width, sizes } = ART[art];
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <SceneIllustration scene={scene} sizes={sizes} className={width} />
      <p className="text-muted-foreground font-handwritten text-lg">{caption}</p>
    </div>
  );
}
