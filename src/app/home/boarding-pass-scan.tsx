"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BarcodeDetector as BarcodeDetectorType } from "barcode-detector/ponyfill";
import { parseBoardingPass, type BoardingPassLeg } from "@/lib/bcbp";

type Detector = { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
const FORMATS = ["pdf417", "aztec", "qr_code"];

// 브라우저 내장 BarcodeDetector(Android Chrome 등)가 탑승권 형식(PDF417)을
// 지원하면 그걸, 아니면(데스크톱 등) 오픈소스 zxing 기반 대체 구현을 필요할 때만
// 불러온다. 대체 구현의 wasm은 jsDelivr에서 받는다 — 바코드 이미지는 기기 밖으로
// 나가지 않는다.
async function getDetector(): Promise<Detector> {
  const Native = (globalThis as unknown as { BarcodeDetector?: typeof BarcodeDetectorType })
    .BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(() => [] as string[]);
    if (supported.includes("pdf417")) return new Native({ formats: FORMATS as never });
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: FORMATS as never });
}

/**
 * 탑승권 바코드로 채우기(PRD §3.3.1). 카메라로 비추거나, 모바일 탑승권
 * 스크린샷·사진에서 읽는다. 편명·공항·날짜만 넘기고 나머지는 버린다.
 */
export function BoardingPassScan({ onScanned }: { onScanned: (leg: BoardingPassLeg) => void }) {
  const [mode, setMode] = useState<"idle" | "choose" | "camera">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handle(values: string[]) {
    for (const value of values) {
      const leg = parseBoardingPass(value);
      if (leg) {
        setMode("idle");
        setMessage(null);
        onScanned(leg);
        return true;
      }
    }
    if (values.length > 0) setMessage("탑승권 바코드가 아닌 것 같아요");
    return false;
  }

  // 카메라: 비추는 동안 0.4초마다 읽어 본다. 닫히면 카메라를 끈다.
  useEffect(() => {
    if (mode !== "camera") return;
    let stopped = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        const detector = await getDetector();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        while (!stopped) {
          const found = await detector.detect(video).catch(() => []);
          if (handle(found.map((b) => b.rawValue))) break;
          await new Promise((r) => setTimeout(r, 400));
        }
      } catch {
        if (!stopped) {
          setMessage("카메라를 쓸 수 없어요. 탑승권 사진에서 읽어 보세요");
          setMode("choose");
        }
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // handle은 매 렌더 새로 만들어지지만 스캔 루프는 모드가 바뀔 때만 다시 시작한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function readFile(file: File) {
    setMessage(null);
    try {
      const detector = await getDetector();
      const bitmap = await createImageBitmap(file);
      const found = await detector.detect(bitmap);
      if (!handle(found.map((b) => b.rawValue)) && found.length === 0) {
        setMessage("바코드를 찾지 못했어요. 바코드가 크게 나온 사진으로 다시 해 보세요");
      }
    } catch {
      setMessage("사진을 읽지 못했어요");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {mode === "idle" ? (
        <Button type="button" variant="outline" size="lg" onClick={() => setMode("choose")}>
          <ScanLine className="size-5" />
          탑승권 바코드로 채우기
        </Button>
      ) : (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
          {mode === "camera" && (
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="탑승권 바코드를 비춰 주세요"
              className="bg-muted aspect-[4/3] w-full rounded-md object-cover"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode(mode === "camera" ? "choose" : "camera")}
            >
              <Camera className="size-4" />
              {mode === "camera" ? "카메라 끄기" : "카메라로 스캔"}
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageUp className="size-4" />
              사진에서 읽기
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="탑승권 사진"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <p className="text-muted-foreground text-xs">
            편명·공항·날짜만 가져와요. 이름·예약번호는 저장하지 않아요.
          </p>
        </div>
      )}
      {message && <p className="text-danger text-sm">{message}</p>}
    </div>
  );
}
