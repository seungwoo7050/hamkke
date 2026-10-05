// 실제 Supabase 프로젝트에 대고 브로드캐스트 왕복을 검증하는 연결 스모크
// 테스트. NEXT_PUBLIC_SUPABASE_URL 등이 .env에 있어야 통과한다.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { hasRealtime } from "@/test/services";
import { broadcastToSpace } from "./broadcast";
import { spaceChannelName } from "./channels";

describe.skipIf(!hasRealtime)("Supabase Realtime broadcast", () => {
  it("서버(secret key)가 보낸 브로드캐스트를 구독자(publishable key)가 실제로 받는다", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;
    const channelName = spaceChannelName(`test-${Date.now()}`);

    const subscriber = createClient(url, publishableKey);
    const sender = createClient(url, secretKey);

    try {
      const receivedPayload = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("브로드캐스트 수신 타임아웃")), 10000);

        const subChannel = subscriber.channel(channelName);
        subChannel
          .on("broadcast", { event: "test" }, (message) => {
            clearTimeout(timeout);
            resolve(message.payload);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              sender
                .channel(channelName)
                .send({ type: "broadcast", event: "test", payload: { hello: "world" } });
            }
          });
      });

      expect(receivedPayload).toEqual({ hello: "world" });
    } finally {
      await subscriber.removeAllChannels();
      await sender.removeAllChannels();
    }
  }, 15000);

  it("broadcastToSpace(REST httpSend)로 보낸 이벤트를 구독자가 받는다", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const spaceId = `test-${Date.now()}`;
    const subscriber = createClient(url, publishableKey);

    try {
      const received = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("브로드캐스트 수신 타임아웃")), 10000);
        subscriber
          .channel(spaceChannelName(spaceId))
          .on("broadcast", { event: "touch" }, (message) => {
            clearTimeout(timeout);
            resolve(message.payload);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") void broadcastToSpace(spaceId, "touch", { id: "t1" });
          });
      });
      expect(received).toEqual({ id: "t1" });
    } finally {
      await subscriber.removeAllChannels();
    }
  }, 15000);
});
