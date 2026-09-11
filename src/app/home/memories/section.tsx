"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { LoadingMotif } from "@/components/brand/loading-motif";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// 기억 탭의 한 묶음(기념일·일정·캡슐…). 입력 폼은 목록 위에 상시 펼쳐두지
// 않고 제목 옆 "+"가 여는 시트 안에 둔다 — 목록이 화면의 주인공이고, 추가는
// 가끔 하는 행동이라서(DESIGN.md §4 화면당 하나의 초점).
export function Section({
  title,
  addTitle,
  renderAdd,
  defaultAddOpen = false,
  children,
}: {
  title: string;
  addTitle?: string;
  renderAdd?: (close: () => void) => React.ReactNode;
  /** 상황 카드(첫날 안내)에서 들어왔을 때 추가 시트를 바로 연다. */
  defaultAddOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultAddOpen);

  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-1 flex min-h-9 items-center justify-between">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {renderAdd && (
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={addTitle}
                className="text-muted-foreground"
              >
                <Plus className="size-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="pb-4">
                <DrawerTitle>{addTitle}</DrawerTitle>
              </DrawerHeader>
              {renderAdd(() => setOpen(false))}
            </DrawerContent>
          </Drawer>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** 섹션 안 한 줄 — 아이콘 · 제목/보조문구 · 오른쪽 끝 값. */
export function Row({
  icon,
  title,
  sub,
  end,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div className="border-muted flex items-center gap-3 border-t py-2.5 first:border-t-0">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-base font-medium">{title}</p>
        {sub && <p className="text-muted-foreground truncate text-sm">{sub}</p>}
      </div>
      {end}
    </div>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-2 text-sm">{children}</p>;
}

/** 목록을 불러오는 동안 빈 상태 문구가 잠깐 비치지 않게 작은 모티프를 둔다. */
export function LoadingRow() {
  return (
    <div className="py-2">
      <LoadingMotif compact />
    </div>
  );
}
