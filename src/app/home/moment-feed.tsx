"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Section } from "./memories/section";
import { UpgradeHint } from "./upgrade-hint";
import { displayName, useSpace } from "./space-context";

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
  const listQuery = useQuery(trpc.moment.list.queryOptions({}));
  const deleteMutation = useMutation(
    trpc.moment.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

  const moments = listQuery.data?.moments ?? [];
  const [latest, ...rest] = moments;
  const pairs: Moment[][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));

  function remove(id: string) {
    deleteMutation.mutate({ id });
  }

  return (
    <Section
      title="사진"
      addTitle="사진 올리기"
      renderAdd={(close) => <MomentForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : !latest ? (
        <EmptyRow>오늘 본 하늘, 먹은 것 — 사소한 장면일수록 좋아요</EmptyRow>
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
  const { summary } = useSpace();
  const who = mine ? "나" : displayName(summary.partner, "상대");
  return (
    <figure className="group relative overflow-hidden rounded-lg">
      <Image
        src={moment.mediaUrl}
        alt={moment.caption ?? "오늘의 사진"}
        width={large ? 720 : 360}
        height={large ? 540 : 240}
        unoptimized
        className={`w-full object-cover ${large ? "aspect-4/3" : "aspect-3/2"}`}
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
          aria-label="사진 삭제"
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
      toast.error("jpg, png, webp, gif 이미지만 올릴 수 있어요");
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
      // 무료 티어 한도 초과 같은 안내는 그대로 보여준다(src/lib/plan.ts).
      toast.error(err instanceof Error ? err.message : "사진 업로드에 실패했어요");
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
        placeholder="한 줄 남기기(선택)"
      />
      <Button
        type="button"
        size="lg"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus className="size-5" /> {uploading ? "올리는 중..." : "사진 고르기"}
      </Button>
    </div>
  );
}
