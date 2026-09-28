"use client";

import * as React from "react";
import { cn } from "cn";
import { Drawer as DrawerPrimitive } from "vaul";

/**
 * 바텀시트(DESIGN.md §2 Emil Kowalski/Vaul, §4 "상세는 시트로"). shadcn/ui
 * drawer 레지스트리 항목과 같은 구조 - 이 환경에서 shadcn 레지스트리
 * (ui.shadcn.com)가 네트워크 정책으로 막혀 있어 같은 구조를 토큰 기준으로
 * 직접 옮겼다. Vaul 기본 전환 곡선이 --ease-standard(0.32, 0.72, 0, 1)와
 * 같아 별도로 덮어쓰지 않는다. snap point가 필요한 시트는 Root에
 * snapPoints/activeSnapPoint를 넘긴다.
 */
function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger(props: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      // 순수 black 금지(DESIGN.md §3.3) - zinc-900 토큰 기반 반투명.
      className={cn("fixed inset-0 z-50 bg-zinc-900/40", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "bg-background shadow-elevated fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-xl px-4 pb-6 outline-none",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="bg-border mx-auto mt-2 mb-4 h-1.5 w-10 shrink-0 rounded-full" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="drawer-header" className={cn("flex flex-col gap-1", className)} {...props} />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground text-xl font-bold tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
};
