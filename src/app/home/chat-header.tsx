"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { isLikelySleeping } from "@/lib/timezone";
import { PersonAvatar } from "./person-avatar";
import { usePartnerPresent } from "./presence-context";
import { usePartnerName, useSpace } from "./space-context";

// 대화 상단 — 상대가 지금 몇 시에 있는지를 대화 맥락 바로 위에 둔다(승인
// 목업 ②). 새벽에 보내는 메시지가 어떻게 닿을지 보내기 전에 알 수 있게.
export function ChatHeader() {
  const { summary } = useSpace();
  const t = useTranslations("chat");
  const fmt = useFormat();
  const partner = summary.partner;
  const partnerName = usePartnerName();
  const present = usePartnerPresent();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tz = partner?.timezone;
  const sleeping = tz ? isLikelySleeping(tz, now) : false;

  return (
    <header className="border-border flex shrink-0 items-center gap-2.5 border-b px-4 pt-4 pb-3">
      <PersonAvatar person={partner} who="partner" fallback={partnerName} />
      <div>
        <h1 className="text-foreground text-base font-semibold">{partnerName}</h1>
        {tz && (
          <p
            className="text-muted-foreground flex items-center gap-1 text-xs"
            suppressHydrationWarning
          >
            {sleeping && <Moon className="size-3.5" />}
            {fmt.time(now, tz)}
            {present ? ` · ${t("presentNow")}` : sleeping && ` · ${t("sleeping")}`}
          </p>
        )}
      </div>
    </header>
  );
}
