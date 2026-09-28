"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Hourglass, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DateField, localTodayValue } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/i18n/use-format";
import { dateOnly, daysBetween, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone } from "./space-context";

// PRD.md §3.4 "다음 만남까지 카운트다운" - 가장 가까운 목표일 하나를 크게
// (DESIGN.md §2 M3 Expressive 크기 대비), 나머지는 작은 줄로.
export function CountdownTracker({ openAdd = false }: { openAdd?: boolean }) {
  const trpc = useTRPC();
  const t = useTranslations("countdown");
  const tm = useTranslations("memories");
  const fmt = useFormat();
  const myTz = useMyTimeZone();
  const now = useNow();
  const listQuery = useQuery(trpc.countdown.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.countdown.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const upcoming = useMemo(() => {
    if (!listQuery.data) return [];
    const today = todayIn(myTz, now);
    return listQuery.data
      .map((c) => {
        const target = dateOnly(c.targetDate);
        return { ...c, target, days: daysBetween(today, target) };
      })
      .filter((c) => c.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [listQuery.data, myTz, now]);

  const [next, ...rest] = upcoming;

  return (
    <Section
      title={t("title")}
      addTitle={t("addTitle")}
      defaultAddOpen={openAdd}
      renderAdd={(close) => <CountdownForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : next ? (
        <div className="bg-sky-dusk rounded-xl p-5">
          <p className="text-dusk-ink text-sm font-medium">{next.title}</p>
          <p className="text-foreground mt-1 text-5xl font-bold tracking-tight">
            {fmt.ddayBig(next.days)}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {fmt.ymd(next.target, { weekday: true })}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tm("delete", { title: next.title })}
              className="text-muted-foreground"
              onClick={() => deleteMutation.mutate({ id: next.id })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <EmptyRow>{t("empty")}</EmptyRow>
      )}
      {rest.map((c) => (
        <Row
          key={c.id}
          icon={<Hourglass className="text-dusk-ink size-5" />}
          title={c.title}
          end={
            <>
              <span className="text-dusk-ink text-sm font-semibold">{fmt.dday(c.days)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tm("delete", { title: c.title })}
                className="text-muted-foreground"
                onClick={() => deleteMutation.mutate({ id: c.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          }
        />
      ))}
    </Section>
  );
}

function CountdownForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const t = useTranslations("countdown");
  const tm = useTranslations("memories");
  const [title, setTitle] = useState(() => t("defaultTitle"));
  const [targetDate, setTargetDate] = useState(() => localTodayValue());
  const createMutation = useMutation(
    trpc.countdown.create.mutationOptions({
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
        createMutation.mutate({ title: title.trim(), targetDate });
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("placeholder")}
      />
      <DateField label={t("dateLabel")} value={targetDate} onChange={setTargetDate} />
      <Button type="submit" size="lg" disabled={!title.trim() || createMutation.isPending}>
        {tm("add")}
      </Button>
    </form>
  );
}
