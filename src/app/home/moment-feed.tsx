"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, LoadMore, Section } from "./memories/section";
import { UpgradeHint } from "./upgrade-hint";
import { usePartnerName, useSpace } from "./space-context";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

type Moment = {
  id: string;
  mediaUrl: string;
  caption: string | null;
  uploaderId: string;
  createdAt: Date | string;
};

// "오늘의 사진" 피드(PRD.md §3.4). 균등한 그리드 대신 가장 최근 한 장만 크게,
// 나머지는 2:1 비율 줄로(DESIGN.md §10 크기 대비, 승인 목업 ④).
export function MomentFeed() {
  const trpc = useTRPC();
  const { currentUserId } = useSpace();
  const t = useTranslations("moments");
  const listQuery = useInfiniteQuery(
    trpc.moment.list.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const deleteMutation = useMutation(
    trpc.moment.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const moments = listQuery.data?.pages.flatMap((page) => page.moments) ?? [];
  const [latest, ...rest] = moments;
  const pairs: Moment[][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));

  function remove(id: string) {
    deleteMutation.mutate({ id });
  }

  return (
    <Section
      title={t("title")}
      addTitle={t("addTitle")}
      renderAdd={(close) => <MomentForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : !latest ? (
        <EmptyRow>{t("empty")}</EmptyRow>
      ) : (
        <div className="flex flex-col gap-2">
          <MomentTile
            moment={latest}
            large
            mine={latest.uploaderId === currentUserId}
            onDelete={remove}
          />
          {pairs.map((pair, i) => (
            <div
              key={pair[0].id}
              className={`grid gap-2 ${i % 2 ? "grid-cols-[1fr_2fr]" : "grid-cols-[2fr_1fr]"}`}
            >
              {pair.map((m) => (
                <MomentTile
                  key={m.id}
                  moment={m}
                  mine={m.uploaderId === currentUserId}
                  onDelete={remove}
                />
              ))}
            </div>
          ))}
          <LoadMore
            hasMore={listQuery.hasNextPage}
            loading={listQuery.isFetchingNextPage}
            onLoad={() => void listQuery.fetchNextPage()}
          />
        </div>
      )}
    </Section>
  );
}

function MomentTile({
  moment,
  large,
  mine,
  onDelete,
}: {
  moment: Moment;
  large?: boolean;
  mine: boolean;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("moments");
  const tc = useTranslations("common");
  const partnerName = usePartnerName();
  const who = mine ? tc("me") : partnerName;
  return (
    // 2:1 줄의 두 칸은 폭이 달라도 높이가 같아야 한 줄로 읽힌다 — 줄 칸은 높이를
    // 고정하고 사진을 그 안에 채운다(폭 비율로 높이를 정하면 좁은 칸이 짧아짐).
    <figure
      className={`group relative overflow-hidden rounded-lg ${large ? "aspect-4/3" : "h-40"}`}
    >
      <Image
        src={moment.mediaUrl}
        alt={moment.caption ?? t("altDefault")}
        width={large ? 720 : 360}
        height={large ? 540 : 240}
        unoptimized
        className="size-full object-cover"
      />
      {large && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-zinc-900/60 to-transparent px-3 pt-8 pb-2.5 text-sm font-medium text-zinc-50">
          {who}
          {moment.caption && ` · ${moment.caption}`}
        </figcaption>
      )}
      {mine && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-background/80 duration-fast ease-standard absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={t("delete")}
          onClick={() => onDelete(moment.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </figure>
  );
}

// presigned PUT 패턴은 chat-view.tsx의 이미지 업로드와 동일(moment 전용 URL).
function MomentForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const t = useTranslations("moments");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const createUploadUrlMutation = useMutation(trpc.moment.createUploadUrl.mutationOptions());
  const createMutation = useMutation(trpc.moment.create.mutationOptions());

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      toast.error(t("imageTypes"));
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, key } = await createUploadUrlMutation.mutateAsync({
        contentType: file.type as AllowedImageType,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`R2 업로드 실패: ${res.status}`);
      await createMutation.mutateAsync({ key, caption: caption.trim() || undefined });
      onCreated();
      onDone();
    } catch (err) {
      // 무료 티어 한도 초과 같은 서버 안내는 그대로(src/lib/plan.ts), 업로드
      // 자체의 실패(R2 응답 등 내부 에러)는 사람이 읽을 문구로.
      toast.error(err instanceof TRPCClientError ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <UpgradeHint usageKey="moments" />
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={handleFileSelect}
      />
      <Input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={t("captionPlaceholder")}
      />
      <Button
        type="button"
        size="lg"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus className="size-5" /> {uploading ? t("uploading") : t("choose")}
      </Button>
    </div>
  );
}
