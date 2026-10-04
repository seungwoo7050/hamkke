"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LogOut, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { LEGAL_SLUGS } from "@/legal/slugs";
import { useTRPC } from "@/trpc/client";
import { signOutAction } from "./actions";
import { BillingSection } from "./billing-section";
import { DeleteAccountSection } from "./delete-account-section";
import { GeofenceManager } from "./geofence-manager";
import { LanguageSection } from "./language-section";
import { useLocationSharing } from "./location-context";
import { NotificationSection } from "./notification-section";
import { PersonAvatar } from "./person-avatar";
import { displayName, usePartnerName, useSpace } from "./space-context";

// 설정성 기능(위치공유·도착 알림 장소·구독·로그아웃)은 탭이나 홈 본문에 두지
// 않고 우상단 아바타에서 여는 이 시트에만 모은다(DESIGN.md §4, Calm
// Technology - 거의 안 쓰는 것은 시야 밖으로).
export function SettingsSheet() {
  const { summary } = useSpace();
  const { sharing, toggleSharing, togglePending } = useLocationSharing();
  const tl = useTranslations("legal");
  const trpc = useTRPC();
  // 위치 제공 내역(위치정보법 §19) - 30일마다 알림으로도 보내지만 언제든 여기서 본다.
  const provided = useQuery({ ...trpc.location.providedRecently.queryOptions(), enabled: sharing });
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const myName = displayName(summary.me, tc("me"));
  const partnerName = usePartnerName();

  return (
    <Drawer>
      <DrawerTrigger aria-label={t("open")} className="rounded-full">
        <PersonAvatar person={summary.me} who="me" fallback={tc("me")} />
      </DrawerTrigger>
      <DrawerContent>
        <div className="overflow-y-auto">
          <DrawerHeader className="flex-row items-center gap-3 pb-3">
            <PersonAvatar person={summary.me} who="me" size={48} fallback={tc("me")} />
            <div>
              <DrawerTitle>{myName}</DrawerTitle>
              <DrawerDescription>{t("together", { name: partnerName })}</DrawerDescription>
            </div>
          </DrawerHeader>

          <div className="divide-muted flex flex-col divide-y">
            <label className="flex items-center gap-3 py-3">
              <MapPin className="text-dusk-ink size-5" />
              <div className="flex-1">
                <p className="text-foreground text-base font-medium">{t("locationSharing")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("locationSharingSub", { name: partnerName })}
                </p>
                {sharing && provided.data ? (
                  <p className="text-muted-foreground text-xs">
                    {t("locationProvided", { name: partnerName, count: provided.data })}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={sharing}
                disabled={togglePending}
                onCheckedChange={() => void toggleSharing()}
              />
            </label>
            <GeofenceManager />
            <NotificationSection />
            <LanguageSection />
            <BillingSection />
            <form action={signOutAction} className="py-2">
              <Button type="submit" variant="ghost" className="text-destructive -mx-3.5">
                <LogOut className="size-5" /> {t("signOut")}
              </Button>
            </form>
            <div className="pb-2">
              <DeleteAccountSection partnerName={summary.partner ? partnerName : undefined} />
            </div>
            {/* 정책 문서는 시트 맨 아래 조용한 링크로(설정성 정보, DESIGN.md §4). */}
            <nav
              aria-label={tl("others")}
              className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-3 pb-2 text-xs"
            >
              {LEGAL_SLUGS.map((slug) => (
                <Link
                  key={slug}
                  href={`/legal/${slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {tl(slug)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
