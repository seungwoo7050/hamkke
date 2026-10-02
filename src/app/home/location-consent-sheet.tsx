"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { usePartnerName } from "./space-context";

/**
 * 위치 공유를 켜기 전의 동의(위치정보법 §19①②④). 누가(상대 한 사람), 무엇을(최근 위치·
 * 거리·도착), 얼마나(7일), 어떻게 알리는지(30일 모아서)를 짧게 말하고 약관 전문으로
 * 잇는다. 체크해야 켤 수 있다 - 서버(location.setSharing)도 동의 없이는 켜지 않는다.
 */
export function LocationConsentSheet({
  open,
  pending,
  onOpenChange,
  onAgree,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}) {
  const t = useTranslations("location");
  const name = usePartnerName();
  const [agreed, setAgreed] = useState(false);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setAgreed(false);
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerHeader className="pb-3">
          <DrawerTitle>{t("consentTitle")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("consentShare", { name })}</DrawerDescription>
        </DrawerHeader>
        <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed break-keep">
          <li>{t("consentShare", { name })}</li>
          <li>{t("consentCollect")}</li>
          <li>{t("consentNotice", { name })}</li>
        </ul>
        <div className="mt-5 flex items-center gap-3">
          <label className="text-foreground flex flex-1 items-center gap-3 text-sm font-medium">
            <Checkbox checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
            {t("consentAgree")}
          </label>
          <Link
            href="/legal/location"
            target="_blank"
            className="text-primary shrink-0 text-sm underline-offset-4 hover:underline"
          >
            {t("consentTerms")}
          </Link>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" disabled={!agreed || pending} onClick={onAgree}>
            {t("consentConfirm")}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("consentCancel")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
