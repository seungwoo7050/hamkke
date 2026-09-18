"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookHeart, MessageCircle, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { useTRPC } from "@/trpc/client";
import { useSpaceBroadcast } from "./realtime-context";
import { useSpace } from "./space-context";

// Material 3 내비게이션 바 문법(DESIGN.md §2) — 활성 탭은 아이콘 뒤 pill로
// 표시한다. "홈" 대신 범위가 분명한 이름을 쓴다(Apple HIG, DESIGN.md §4).
const TABS = [
  { href: "/home", key: "us", Icon: UsersRound },
  { href: "/home/chat", key: "chat", Icon: MessageCircle },
  { href: "/home/memories", key: "memories", Icon: BookHeart },
] as const;

// 안 읽은 메시지 배지는 새 메시지 Broadcast가 올 때와 탭을 옮길 때 다시
// 센다. 대화 탭 안에서는 chat-view가 읽음 처리 후 이 쿼리를 무효화한다.
function useUnreadCount(pathname: string) {
  const trpc = useTRPC();
  const { currentUserId, summary } = useSpace();
  const query = useQuery({
    ...trpc.chat.unreadCount.queryOptions(),
    initialData: summary.unreadCount,
  });
  const { refetch } = query;

  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);

  useSpaceBroadcast<{ senderId: string }>("message", ({ senderId }) => {
    if (senderId !== currentUserId) void refetch();
  });

  return query.data ?? 0;
}

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const unread = useUnreadCount(pathname);

  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-background grid shrink-0 grid-cols-3 border-t px-3 pt-2 pb-4"
    >
      {TABS.map(({ href, key, Icon }) => {
        const label = t(key);
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={
              href === "/home/chat" && unread > 0
                ? t("unread", { label, count: unread })
                : undefined
            }
            className={cn(
              "text-muted-foreground relative flex flex-col items-center gap-1 text-xs font-medium",
              active && "text-foreground font-semibold",
            )}
          >
            <span
              className={cn(
                "duration-base ease-standard relative grid h-8 w-14 place-items-center transition-colors",
                active && "text-primary",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="nav-indicator-in bg-primary/15 absolute inset-0 rounded-full"
                />
              )}
              <Icon className="relative size-6" />
            </span>
            {label}
            {href === "/home/chat" && !active && unread > 0 && (
              <span className="bg-primary text-primary-foreground absolute top-0 left-1/2 ml-2.5 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-xs font-bold">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
