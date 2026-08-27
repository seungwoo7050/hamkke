"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { spaceChannelName } from "@/lib/supabase/channels";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC, useTRPCClient } from "@/trpc/client";

type ChatMessage = inferRouterOutputs<AppRouter>["chat"]["list"]["messages"][number];

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(spaceChannelName(spaceId));
    channel
      .on("broadcast", { event: "message" }, (msg) => {
        setMessages((prev) =>
          mergeById(prev, [normalizeBroadcastMessage(msg.payload as ChatMessage)]),
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

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
              className={`flex max-w-[75%] flex-col gap-1 rounded-lg px-3 py-2 ${
                isMine
                  ? "bg-primary text-primary-foreground self-end"
                  : "bg-muted text-foreground self-start"
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          );
        })}
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
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메시지 보내기"
        />
        <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
