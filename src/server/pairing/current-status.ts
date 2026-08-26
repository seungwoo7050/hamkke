import "server-only";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

const createCaller = createCallerFactory(appRouter);

/** 호출 전 auth()로 로그인 여부를 먼저 확인해야 한다(비로그인 시 UNAUTHORIZED). */
export async function getCurrentPairingStatus() {
  const caller = createCaller(await createTRPCContext());
  return caller.pairing.getStatus();
}
