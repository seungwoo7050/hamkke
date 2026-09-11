"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowUp, Heart, ImagePlus, Mic, Square } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { josa } from "@/lib/josa";
import { groupPositions } from "@/lib/chat-grouping";
import { daysBetween, formatDayLabel, formatTime, todayIn } from "@/lib/datetime";
import { useNow } from "@/lib/use-now";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { ChatHeader } from "./chat-header";
import { VoiceMessage } from "./voice-message";
import { useSpaceBroadcast, useSpaceRealtime } from "./realtime-context";
import { displayName, useMyTimeZone, useSpace } from "./space-context";

type ChatMessage = inferRouterOutputs<AppRouter>["chat"]["list"]["messages"][number];
type Touch = inferRouterOutputs<AppRouter>["touch"]["list"][number];
type TimelineItem =
  { kind: "message"; at: Date; message: ChatMessage } | { kind: "touch"; at: Date; touch: Touch };

// 메시지가 하나도 없을 때 터치를 얼마나 거슬러 보여줄지.
const EMPTY_CHAT_TOUCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const TYPING_THROTTLE_MS = 2000;
const TYPING_CLEAR_MS = 3000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"] as const;
type AllowedAudioType = (typeof ALLOWED_AUDIO_TYPES)[number];
// 브라우저마다 지원하는 녹음 포맷이 달라 우선순위대로 확인한다(Chrome은 webm,
// Safari는 mp4 계열을 주로 지원).
const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

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
  initialMessages,
  initialNextCursor,
}: {
  initialMessages: ChatMessage[];
  initialNextCursor?: string;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { currentUserId, summary } = useSpace();
  const { send: sendRealtime, connected: realtimeConnected } = useSpaceRealtime();
  const myTz = useMyTimeZone();
  const now = useNow();
  const partnerName = displayName(summary.partner, "상대");
  const [messages, setMessages] = useState(initialMessages);
  const [olderCursor, setOlderCursor] = useState(initialNextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReadMutation = useMutation(
    trpc.chat.markRead.mutationOptions({
      // 대화 탭 배지(bottom-nav)가 바로 0으로 떨어지게 한다.
      onSuccess: () => queryClient.invalidateQueries(trpc.chat.unreadCount.queryFilter()),
    }),
  );

  // 받은/보낸 터치를 대화 흐름 안에 끼워 넣는다(승인 목업 ②). 불러온 메시지
  // 범위와 같은 구간만 조회한다.
  const [touchSince] = useState(() =>
    initialMessages[0]
      ? new Date(initialMessages[0].createdAt)
      : new Date(Date.now() - EMPTY_CHAT_TOUCH_WINDOW_MS),
  );
  const touchQuery = useQuery(trpc.touch.list.queryOptions({ since: touchSince }));
  const [liveTouches, setLiveTouches] = useState<Touch[]>([]);

  // Realtime 구독 성공(SUBSCRIBED)만 기다리면 소켓이 막힌 환경에서 영영 읽음
  // 처리가 안 된다 — 대화 탭을 연 것 자체를 "읽음"으로 본다.
  useEffect(() => {
    markReadMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSpaceBroadcast<ChatMessage>("message", (payload) => {
    const message = normalizeBroadcastMessage(payload);
    setMessages((prev) => mergeById(prev, [message]));
    if (message.senderId !== currentUserId) markReadMutation.mutate();
  });

  useSpaceBroadcast<{ readAt: string; readBy: string }>("read", ({ readAt }) => {
    const readAtDate = new Date(readAt);
    setMessages((prev) =>
      prev.map((m) =>
        m.senderId === currentUserId && new Date(m.createdAt) <= readAtDate && !m.readAt
          ? { ...m, readAt: readAtDate }
          : m,
      ),
    );
  });

  useSpaceBroadcast<Touch>("touch", (touch) => {
    setLiveTouches((prev) => [...prev, { ...touch, createdAt: new Date(touch.createdAt) }]);
  });

  useSpaceBroadcast<{ userId: string }>("typing", ({ userId }) => {
    if (userId === currentUserId) return;
    setPartnerTyping(true);
    if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    typingClearTimer.current = setTimeout(() => setPartnerTyping(false), TYPING_CLEAR_MS);
  });

  // 끊겼다 다시 연결되면 그사이 온 메시지가 있을 수 있어 다시 읽음 처리한다.
  useEffect(() => {
    if (realtimeConnected) markReadMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConnected]);

  useEffect(
    () => () => {
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    },
    [],
  );

  const timeline = useMemo(() => {
    const touches = new Map<string, Touch>();
    for (const t of [...(touchQuery.data ?? []), ...liveTouches]) touches.set(t.id, t);
    const items: TimelineItem[] = [
      ...messages.map((m) => ({ kind: "message" as const, at: new Date(m.createdAt), message: m })),
      ...[...touches.values()].map((t) => ({
        kind: "touch" as const,
        at: new Date(t.createdAt),
        touch: t,
      })),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [messages, touchQuery.data, liveTouches]);

  const positions = useMemo(
    () =>
      groupPositions(
        timeline.map((item) =>
          item.kind === "message"
            ? { kind: "message" as const, senderId: item.message.senderId, at: item.at }
            : { kind: "touch" as const, at: item.at },
        ),
        myTz,
      ),
    [timeline, myTz],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [timeline.length]);

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
      onSuccess: (touch) => setLiveTouches((prev) => [...prev, touch]),
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

  const createVoiceUploadUrlMutation = useMutation(
    trpc.chat.createVoiceUploadUrl.mutationOptions(),
  );
  const sendVoiceMutation = useMutation(
    trpc.chat.sendVoice.mutationOptions({
      onSuccess: (message) => setMessages((prev) => mergeById(prev, [message])),
    }),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  async function handleVoiceRecorded(blob: Blob) {
    setUploadingVoice(true);
    try {
      const contentType = blob.type.split(";")[0] as AllowedAudioType;
      if (!ALLOWED_AUDIO_TYPES.includes(contentType)) {
        throw new Error(`지원하지 않는 오디오 형식: ${blob.type}`);
      }
      const { uploadUrl, key } = await createVoiceUploadUrlMutation.mutateAsync({ contentType });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!res.ok) throw new Error(`R2 업로드 실패: ${res.status}`);
      await sendVoiceMutation.mutateAsync({ key });
    } catch {
      toast.error("음성 메시지 전송에 실패했어요");
    } finally {
      setUploadingVoice(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        void handleVoiceRecorded(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("마이크 권한이 필요해요");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      sendRealtime("typing", { userId: currentUserId });
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-1 pb-4">
        {timeline.length === 0 && (
          <EmptyState caption="아직 나눈 이야기가 없어요" className="flex-1" />
        )}
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
        {timeline.map((item, i) => {
          const prev = timeline[i - 1];
          const position = positions[i];
          const newDay = !prev || daysBetween(todayIn(myTz, prev.at), todayIn(myTz, item.at)) !== 0;
          const divider = newDay && (
            <p className="text-muted-foreground mt-4 mb-1 text-center text-xs">
              {formatDayLabel(item.at, myTz, now)}
            </p>
          );

          if (item.kind === "touch") {
            const fromMe = item.touch.senderId === currentUserId;
            return (
              <div key={`touch-${item.touch.id}`} className="contents">
                {divider}
                <p className="bg-glow/30 text-dusk-ink font-handwritten mt-3 flex items-center gap-1.5 self-center rounded-full px-3 py-1 text-lg">
                  <Heart className="size-4" />
                  {fromMe
                    ? "생각하고 있다고 전했어요"
                    : `${josa(partnerName, "이/가")} 생각하고 있어요`}
                  <span className="text-base">· {formatTime(item.at, myTz)}</span>
                </p>
              </div>
            );
          }

          const message = item.message;
          const isMine = message.senderId === currentUserId;
          // 묶음 안쪽(이어지는 쪽) 모서리만 줄여 한 덩어리로 보이게.
          const corners = cn(
            isMine
              ? [!position.first && "rounded-tr-sm", !position.last && "rounded-br-sm"]
              : [!position.first && "rounded-tl-sm", !position.last && "rounded-bl-sm"],
          );
          const time = position.last && (
            <time
              dateTime={item.at.toISOString()}
              className="text-muted-foreground shrink-0 pb-0.5 text-xs"
            >
              {formatTime(item.at, myTz)}
            </time>
          );
          return (
            <div key={message.id} className="contents">
              {divider}
              <div
                className={cn(
                  "flex flex-col gap-1",
                  position.first ? "mt-3" : "mt-1",
                  isMine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn("flex max-w-[85%] items-end gap-1.5", isMine && "flex-row-reverse")}
                >
                  {message.type === "image" ? (
                    <Image
                      src={message.content}
                      alt="공유한 사진"
                      width={240}
                      height={240}
                      unoptimized
                      className={cn("h-60 w-60 rounded-lg object-cover", corners)}
                    />
                  ) : message.type === "voice" ? (
                    <VoiceMessage src={message.content} mine={isMine} className={corners} />
                  ) : (
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2",
                        corners,
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  )}
                  {time}
                </div>
                {isMine && message.id === lastReadMineId && (
                  <span className="text-muted-foreground text-xs">읽음</span>
                )}
              </div>
            </div>
          );
        })}
        {partnerTyping && (
          <p className="text-muted-foreground text-xs">{josa(partnerName, "이/가")} 입력 중...</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-border flex items-center gap-1 border-t px-3 py-2.5"
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
          variant="ghost"
          size="icon"
          aria-label="사진 보내기"
          className="text-muted-foreground"
          disabled={uploadingImage}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-5" />
        </Button>
        <Button
          type="button"
          variant={isRecording ? "default" : "ghost"}
          size="icon"
          aria-label={isRecording ? "녹음 중지 및 보내기" : "음성 메시지 녹음"}
          className={isRecording ? undefined : "text-muted-foreground"}
          disabled={uploadingVoice}
          onClick={() => (isRecording ? stopRecording() : startRecording())}
        >
          {isRecording ? <Square className="size-5" /> : <Mic className="size-5" />}
        </Button>
        <Input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="메시지"
          className="mx-1"
        />
        {/* 입력 중이 아닐 땐 전송 버튼 자리를 터치가 차지한다 — 대화 중에도
            한 번에 "생각하고 있어요"를 보낼 수 있게(DESIGN.md §2 Kaye). */}
        {draft.trim() ? (
          <Button type="submit" size="icon" aria-label="보내기" disabled={sendMutation.isPending}>
            <ArrowUp className="size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="생각하고 있어요 보내기"
            className="text-primary"
            disabled={sendTouchMutation.isPending}
            onClick={() => sendTouchMutation.mutate()}
          >
            <Heart className="size-5" />
          </Button>
        )}
      </form>
    </div>
  );
}
