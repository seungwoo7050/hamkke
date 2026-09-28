import { cn } from "cn";
import { SceneIllustration } from "@/components/brand/scene-illustration";

/**
 * 빈 상태 화면 공통 컴포넌트(DESIGN.md §8) - 등을 맞대고 기댄 두 사람 그림
 * 하나만 축소해 쓰고, 화면마다 다른 일러스트를 새로 그리지 않는다. 캡션은 감성
 * 포인트 전용 Gaegu 폰트(`font-handwritten`)로만 표기한다.
 */
export function EmptyState({ caption, className }: { caption: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <SceneIllustration scene="leaning" sizes="7rem" className="w-28" />
      <p className="text-muted-foreground font-handwritten text-lg">{caption}</p>
    </div>
  );
}
