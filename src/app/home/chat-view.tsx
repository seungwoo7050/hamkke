"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { inferRouterOutputs } from "@trpc/server";
import { Heart, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC, useTRPCClient } from "@/trpc/client";

type ChatMessage = inferRouterOutputs<AppRouter>["chat"]["list"]["messages"][number];

const TYPING_THROTTLE_MS = 2000;
const TYPING_CLEAR_MS = 3000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function mergeById(existing: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

// Realtime 브로드캐스트 payload는 JSON을 타고 오므로 Date가 문자열로 온다.
function normalizeBroadcastMessage(payload: ChatMessage): ChatMessage {
  return {
    ...payload,
    createdAt: new Date(payload.createdAt),
    readAt: payload.readAt ? new Date(payload.readAt) : null,
  };
}

export function ChatView({
  spaceId,
  currentUserId,
  initialMessages,
  initialNextCursor,
}: {
  spaceId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  initialNextCursor?: string;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const [messages, setMessages] = useState(initialMessages);
  const [olderCursor, setOlderCursor] = useState(initialNextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReadMutation = useMutation(trpc.chat.markRead.mutationOptions());

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(spaceChannelName(spaceId));
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, (msg) => {
        const message = normalizeBroadcastMessage(msg.payload as ChatMessage);
        setMessages((prev) => mergeById(prev, [message]));
        if (message.senderId !== currentUserId) {
          markReadMutation.mutate();
        }
      })
      .on("broadcast", { event: "read" }, (msg) => {
        const { readAt } = msg.payload as { readAt: string; readBy: string };
        const readAtDate = new Date(readAt);
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId && new Date(m.createdAt) <= readAtDate && !m.readAt
              ? { ...m, readAt: readAtDate }
              : m,
          ),
        );
      })
      .on("broadcast", { event: "typing" }, (msg) => {
        const { userId } = msg.payload as { userId: string };
        if (userId === currentUserId) return;
        setPartnerTyping(true);
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        typingClearTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_CLEAR_MS);
      })
      .on("broadcast", { event: "touch" }, (msg) => {
        const { senderId } = msg.payload as { senderId: string };
        if (senderId === currentUserId) return;
        toast("상대방이 생각하고 있어요");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          markReadMutation.mutate();
        }
      });

    return () => {
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const sendMutation = useMutation(
    trpc.chat.send.mutationOptions({
      onSuccess: (message) => {
        setMessages((prev) => mergeById(prev, [message]));
        setDraft("");
      },
    }),
  );

  const sendTouchMutation = useMutation(
    trpc.touch.send.mutationOptions({
      onSuccess: () => toast("상대방에게 전송했어요"),
    }),
  );

  const createImageUploadUrlMutation = useMutation(
    trpc.chat.createImageUploadUrl.mutationOptions(),
  );
  const sendImageMutation = useMutation(
    trpc.chat.sendImage.mutationOptions({
      onSuccess: (message) => setMessages((prev) => mergeById(prev, [message])),
    }),
  );
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      toast.error("jpg, png, webp, gif 이미지만 보낼 수 있어요");
      return;
    }

    setUploadingImage(true);
    try {
      const { uploadUrl, key } = await createImageUploadUrlMutation.mutateAsync({
        contentType: file.type as AllowedImageType,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`R2 업로드 실패: ${res.status}`);
      await sendImageMutation.mutateAsync({ key });
    } catch {
      toast.error("이미지 전송에 실패했어요");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId },
      });
    }
  }

  async function loadOlder() {
    if (!olderCursor) return;
    setLoadingOlder(true);
    try {
      const result = await trpcClient.chat.list.query({ cursor: olderCursor });
      setMessages((prev) => mergeById(prev, result.messages));
      setOlderCursor(result.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  const lastReadMineId = [...messages]
    .reverse()
    .find((m) => m.senderId === currentUserId && m.readAt)?.id;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        {olderCursor && (
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto w-fit"
            onClick={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? "불러오는 중..." : "이전 메시지 더 보기"}
          </Button>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          return (
            <div
              key={message.id}
              className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
            >
              {message.type === "image" ? (
                <Image
                  src={message.content}
                  alt="공유한 사진"
                  width={240}
                  height={240}
                  unoptimized
                  className="h-60 w-60 rounded-lg object-cover"
                />
              ) : (
                <div
                  className={`flex max-w-[75%] flex-col gap-1 rounded-lg px-3 py-2 ${
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              )}
              {isMine && message.id === lastReadMineId && (
                <span className="text-muted-foreground text-xs">읽음</span>
              )}
            </div>
          );
        })}
        {partnerTyping && <p className="text-muted-foreground text-xs">상대가 입력 중...</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-border flex gap-2 border-t px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMutation.mutate({ content: draft.trim() });
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="사진 보내기"
          disabled={uploadingImage}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus />
        </Button>
        <Input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="메시지 보내기"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="생각하고 있어 보내기"
          disabled={sendTouchMutation.isPending}
          onClick={() => sendTouchMutation.mutate()}
        >
          <Heart />
        </Button>
        <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
