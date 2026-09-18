"use client";

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
import { signOutAction } from "./actions";
import { BillingSection } from "./billing-section";
import { GeofenceManager } from "./geofence-manager";
import { LanguageSection } from "./language-section";
import { useLocationSharing } from "./location-context";
import { PersonAvatar } from "./person-avatar";
import { displayName, usePartnerName, useSpace } from "./space-context";

// 설정성 기능(위치공유·도착 알림 장소·구독·로그아웃)은 탭이나 홈 본문에 두지
// 않고 우상단 아바타에서 여는 이 시트에만 모은다(DESIGN.md §4, Calm
// Technology — 거의 안 쓰는 것은 시야 밖으로).
export function SettingsSheet() {
  const { summary } = useSpace();
  const { sharing, toggleSharing, togglePending } = useLocationSharing();
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
              </div>
              <Switch
                checked={sharing}
                disabled={togglePending}
                onCheckedChange={() => void toggleSharing()}
              />
            </label>
            <GeofenceManager />
            <LanguageSection />
            <BillingSection />
            <form action={signOutAction} className="py-2">
              <Button type="submit" variant="ghost" className="text-destructive -mx-3.5">
                <LogOut className="size-5" /> {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
