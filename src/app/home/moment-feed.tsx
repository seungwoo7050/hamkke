"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

// "오늘의 사진" 피드(PRD.md §3.4). chat-view.tsx의 이미지 업로드와 동일한
// presigned PUT 패턴(chat.createImageUploadUrl)을 moment 전용으로 재사용.
export function MomentFeed({ currentUserId }: { currentUserId: string }) {
  const trpc = useTRPC();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const listQuery = useQuery(trpc.moment.list.queryOptions({}));
  const createUploadUrlMutation = useMutation(trpc.moment.createUploadUrl.mutationOptions());
  const createMutation = useMutation(
    trpc.moment.create.mutationOptions({
      onSuccess: () => {
        setCaption("");
        listQuery.refetch();
      },
    }),
  );
  const deleteMutation = useMutation(
    trpc.moment.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );

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
    } catch (err) {
      // 무료 티어 한도 초과 같은 안내는 그대로 보여준다(src/lib/plan.ts).
      toast.error(err instanceof Error ? err.message : "사진 업로드에 실패했어요");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">오늘의 사진</p>
      <div className="mb-3 flex items-center gap-2">
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
          placeholder="캡션(선택)"
          className="max-w-48"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus /> 사진 올리기
        </Button>
      </div>

      {listQuery.data && listQuery.data.moments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {listQuery.data.moments.map((moment) => (
            <div key={moment.id} className="group relative">
              <Image
                src={moment.mediaUrl}
                alt={moment.caption ?? "오늘의 사진"}
                width={160}
                height={160}
                unoptimized
                className="aspect-square w-full rounded-lg object-cover"
              />
              {moment.caption && (
                <p className="text-muted-foreground mt-1 truncate text-xs">{moment.caption}</p>
              )}
              {moment.uploaderId === currentUserId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="사진 삭제"
                  onClick={() => deleteMutation.mutate({ id: moment.id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
