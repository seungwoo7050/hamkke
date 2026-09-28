import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { prisma } from "@/lib/prisma";
import type { TRPCContext } from "./context";
import { translator } from "@/i18n/server";
import { consumeOrThrow } from "@/server/rate-limit";
import { anyMutationCheck } from "@/server/request-limits";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * 로그인만 요구한다 - 아직 Space가 없는 사용자도 통과(페어링 절차 자체가 이걸 씀).
 * 변경 요청(mutation)은 사용자별 전체 상한을 한 번 센다(src/server/request-limits.ts).
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, type, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (type === "mutation") {
    await consumeOrThrow(anyMutationCheck(ctx.session.user.id), ctx.locale);
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * 로그인 + 활성 Space 멤버십을 요구한다. Phase 2 이후 실제 기능(채팅/위치 등)
 * 라우터가 전부 이걸 쓴다 - "요청자가 이 spaceId의 멤버인가"만 확인하면 되는
 * docs/ARCHITECTURE.md §2의 단순한 권한 모델을 그대로 구현한 것.
 */
export const spaceProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const spaceId = ctx.session.user.spaceId;
  if (!spaceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: translator(ctx.locale)("errors.notPaired") });
  }

  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space || space.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: translator(ctx.locale)("errors.spaceInactive"),
    });
  }

  return next({ ctx: { ...ctx, space } });
});
