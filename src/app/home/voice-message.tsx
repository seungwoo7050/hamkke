"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

function formatSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// 음성 메시지 - 브라우저 기본 <audio controls>는 플랫폼마다 모양이 다르고 앱에서
// 가장 이질적인 요소였다. 텍스트 말풍선과 같은 면·모서리 규칙 안에 재생 버튼,
// 진행 막대, 길이만 둔다. MediaRecorder로 만든 webm은 재생 전까지 길이가
// Infinity로 나오는 브라우저가 있어, 그땐 재생하면서 알게 된 길이를 쓴다.
export function VoiceMessage({
  src,
  mine,
  className,
}: {
  src: string;
  mine: boolean;
  className?: string;
}) {
  const t = useTranslations("chat");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const readDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onTime = () => {
      setCurrent(audio.currentTime);
      readDuration();
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      readDuration();
    };
    audio.addEventListener("loadedmetadata", readDuration);
    audio.addEventListener("durationchange", readDuration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("play", () => setPlaying(true));
    return () => {
      audio.removeEventListener("loadedmetadata", readDuration);
      audio.removeEventListener("durationchange", readDuration);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  const progress = duration ? Math.min(1, current / duration) : 0;

  return (
    <div
      className={cn(
        "flex w-52 items-center gap-2.5 rounded-lg py-2 pr-3 pl-2",
        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("voicePause") : t("voicePlay")}
        className={cn(
          "duration-fast ease-standard grid size-9 shrink-0 place-items-center rounded-full transition-colors",
          mine ? "bg-zinc-900/10 hover:bg-zinc-900/15" : "bg-background hover:bg-background/80",
        )}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="h-1 overflow-hidden rounded-full bg-current/20"
          role="progressbar"
          aria-label={t("voicePosition")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-current" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums opacity-80">
          {playing || current > 0
            ? formatSeconds(current)
            : duration !== null
              ? formatSeconds(duration)
              : t("voiceMessage")}
        </span>
      </div>
    </div>
  );
}
