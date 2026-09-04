import { cn } from "cn";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * 빈 상태 화면 공통 컴포넌트(DESIGN.md §8) — 워드마크 실루엣 하나만 축소
 * 재현해 쓰고, 화면마다 다른 일러스트를 새로 그리지 않는다. 캡션은 감성
 * 포인트 전용 Gaegu 폰트(`font-handwritten`)로만 표기한다.
 */
export function EmptyState({ caption, className }: { caption: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Wordmark className="size-16 opacity-60" />
      <p className="text-muted-foreground font-handwritten text-lg">{caption}</p>
    </div>
  );
}
