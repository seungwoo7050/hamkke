import * as React from "react";
import { cn } from "cn";

// shadcn/ui textarea와 같은 구조를 Input(src/components/ui/input.tsx)과 같은
// 토큰으로 옮겼다(레지스트리가 이 환경 네트워크 정책으로 막혀 직접 작성).
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 duration-base ease-standard flex min-h-24 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
