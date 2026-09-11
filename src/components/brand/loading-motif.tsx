import { cn } from "cn";

/**
 * 연결/로딩 중 인디케이터 — 기본 스피너 대신 브랜드 모티프(서 있는 점 +
 * 그 등에 기댄 점이 균형을 잡는 흔들림)를 쓴다(DESIGN.md §8). 화면마다
 * 다른 로딩 UI를 새로 만들지 않고 이 컴포넌트 하나만 재사용한다.
 */
export function LoadingMotif({
  label,
  compact = false,
  className,
}: {
  label?: string;
  /** 목록 한 줄 자리에 들어가는 작은 크기(절반). 화면 전체 로딩은 기본 크기. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label ?? "불러오는 중"}
      className={cn(
        "flex flex-col gap-4",
        compact ? "h-9 w-11 items-start" : "items-center",
        className,
      )}
    >
      <div
        className={cn("relative h-[72px] w-[88px]", compact && "origin-top-left scale-50")}
        aria-hidden="true"
      >
        <span className="bg-muted absolute right-2 bottom-0 left-2 h-[3px] rounded-full" />
        <span className="motif-dot-standing bg-ember absolute bottom-[3px] left-[14px] size-[30px] origin-bottom rounded-full" />
        <span className="motif-dot-leaning bg-dusk absolute bottom-[3px] left-[38px] size-[30px] origin-bottom-left rounded-full" />
      </div>
      {label && <p className="text-muted-foreground text-sm">{label}</p>}
    </div>
  );
}
