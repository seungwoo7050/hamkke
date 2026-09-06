"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, MessageCircle, UsersRound } from "lucide-react";
import { cn } from "cn";

// Material 3 내비게이션 바 문법(DESIGN.md §2) — 활성 탭은 아이콘 뒤 pill로
// 표시한다. "홈" 대신 범위가 분명한 이름을 쓴다(Apple HIG, DESIGN.md §4).
const TABS = [
  { href: "/home", label: "우리", Icon: UsersRound },
  { href: "/home/chat", label: "대화", Icon: MessageCircle },
  { href: "/home/memories", label: "기억", Icon: BookHeart },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 화면"
      className="border-border bg-background grid shrink-0 grid-cols-3 border-t px-3 pt-2 pb-4"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground flex flex-col items-center gap-1 text-xs font-medium",
              active && "text-foreground font-semibold",
            )}
          >
            <span
              className={cn(
                "duration-base ease-standard grid h-8 w-14 place-items-center rounded-full transition-colors",
                active && "bg-primary/15 text-primary",
              )}
            >
              <Icon className="size-6" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
