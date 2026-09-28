"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { TouchMotif } from "@/components/brand/touch-motif";
import { useFormat } from "@/i18n/use-format";
import { SPRING } from "@/lib/motion";
import { usePartnerName } from "./space-context";

export const TOUCH_RECEIVED_EVENT = "hamkke:touch-received";
const VISIBLE_MS = 2600;

// 터치를 받은 순간(DESIGN.md §8 "터치 알림 수신") - 평범한 토스트 대신 기대는
// 모티프가 화면 가운데 잠깐 나타났다 사라진다. Calm Technology의 "주변부에서
// 중심으로 올라오는 순간"이라 이때만 손글씨(§2 Maggie Appleton)를 쓴다.
// 수신 자체는 app-effects.tsx가 Broadcast로 받아 이 이벤트로 알린다.
export function TouchReceived() {
  const t = useTranslations("touch");
  const fmt = useFormat();
  const partnerName = usePartnerName();
  const [shownAt, setShownAt] = useState<number | null>(null);

  useEffect(() => {
    const show = () => setShownAt(Date.now());
    window.addEventListener(TOUCH_RECEIVED_EVENT, show);
    return () => window.removeEventListener(TOUCH_RECEIVED_EVENT, show);
  }, []);

  useEffect(() => {
    if (shownAt === null) return;
    const id = setTimeout(() => setShownAt(null), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [shownAt]);

  return (
    <AnimatePresence>
      {shownAt !== null && (
        <motion.div
          key={shownAt}
          role="status"
          className="pointer-events-none fixed inset-x-0 top-1/3 z-50 flex justify-center px-4"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING}
        >
          <div className="bg-background shadow-elevated flex flex-col items-center gap-2 rounded-xl px-8 pt-6 pb-5">
            <TouchMotif />
            <p className="font-handwritten text-dusk-ink text-xl">
              {t("received", fmt.particles(partnerName))}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
