"use client";

import * as React from "react";
import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";

// shadcn/ui switch와 같은 구조를 토큰 기준으로 옮겼다(레지스트리가 이 환경
// 네트워크 정책으로 막혀 있어 drawer.tsx와 같은 이유로 직접 작성).
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 duration-fast ease-standard inline-flex h-7 w-11 shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background duration-fast ease-standard pointer-events-none block size-6 rounded-full shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
