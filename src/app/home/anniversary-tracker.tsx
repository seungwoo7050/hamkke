"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Heart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField, localTodayValue } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/i18n/use-format";
import { dateOnly, daysBetween, nextOccurrence, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone } from "./space-context";

// 정확한 시각 push 스케줄러가 아직 없어(docs/COMMIT_PLAN.md Phase 4 각주)
// "다가오는 기념일"은 매 렌더링마다 내 시간대의 오늘 기준으로 다시
// 계산한다(src/lib/datetime.ts). 지난 단발 기념일은 "다가올"에서 뺀다.
export function AnniversaryTracker({ openAdd = false }: { openAdd?: boolean }) {
  const trpc = useTRPC();
  const t = useTranslations("anniversary");
  const tm = useTranslations("memories");
  const fmt = useFormat();
  const myTz = useMyTimeZone();
  const now = useNow();
  const listQuery = useQuery(trpc.anniversary.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.anniversary.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const sorted = useMemo(() => {
    if (!listQuery.data) return [];
    const today = todayIn(myTz, now);
    return [...listQuery.data]
      .map((a) => {
        const occurrence = nextOccurrence(dateOnly(a.date), a.recurring, today);
        return { ...a, occurrence, days: daysBetween(today, occurrence) };
      })
      .filter((a) => a.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data, myTz, now]);

  return (
    <Section
      title={t("title")}
      addTitle={t("addTitle")}
      defaultAddOpen={openAdd}
      renderAdd={(close) => (
        <AnniversaryForm onDone={close} onCreated={() => listQuery.refetch()} />
      )}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : sorted.length === 0 ? (
        <EmptyRow>{t("empty")}</EmptyRow>
      ) : (
        sorted.map((a) => (
          <Row
            key={a.id}
            icon={
              a.recurring ? (
                <Gift className="text-dusk-ink size-5" />
              ) : (
                <Heart className="text-ember size-5" />
              )
            }
            title={a.title}
            sub={
              a.recurring ? t("everyYear", { date: fmt.ymd(a.occurrence) }) : fmt.ymd(a.occurrence)
            }
            end={
              <>
                <span className="text-dusk-ink text-sm font-semibold">{fmt.dday(a.days)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tm("delete", { title: a.title })}
                  className="text-muted-foreground"
                  onClick={() => deleteMutation.mutate({ id: a.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            }
          />
        ))
      )}
    </Section>
  );
}

function AnniversaryForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const t = useTranslations("anniversary");
  const tm = useTranslations("memories");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => localTodayValue());
  const [recurring, setRecurring] = useState(true);
  const createMutation = useMutation(
    trpc.anniversary.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
    }),
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createMutation.mutate({ title: title.trim(), date, recurring });
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("placeholder")}
      />
      <DateField label={t("dateLabel")} value={date} onChange={setDate} />
      <label className="text-foreground flex items-center gap-2 text-sm">
        <Checkbox checked={recurring} onCheckedChange={(checked) => setRecurring(!!checked)} />
        {t("recurring")}
      </label>
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        {tm("add")}
      </Button>
    </form>
  );
}
