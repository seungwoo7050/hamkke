"use client";

import * as React from "react";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

// shadcn/ui select와 같은 구조를 토큰 기준으로 옮겼다(레지스트리가 이 환경에서
// 막혀 있을 때 drawer·switch와 같은 이유로 직접 작성).
const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 duration-base ease-standard flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3.5 text-base transition-colors outline-none focus-visible:ring-3",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="text-muted-foreground size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "bg-popover text-popover-foreground shadow-elevated z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-y-auto rounded-lg border p-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "data-highlighted:bg-muted relative flex h-10 cursor-default items-center rounded-md pr-8 pl-3 text-base outline-none select-none",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
