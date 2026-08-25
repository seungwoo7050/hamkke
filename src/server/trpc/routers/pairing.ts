import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode, inviteCodeExpiryDate } from "@/server/pairing/invite-code";
import { protectedProcedure, router } from "../init";

export const pairingRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const spaceId = ctx.session.user.spaceId;
    if (!spaceId) {
      return { status: "none" as const };
    }

    const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } });
    if (space.status === "active") {
      return { status: "active" as const, spaceId: space.id };
    }

    return {
      status: "pending" as const,
      inviteCode: space.inviteCode,
      inviteCodeExpiresAt: space.inviteCodeExpiresAt,
    };
  }),

  createInviteCode: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const existingSpaceId = ctx.session.user.spaceId;

    if (existingSpaceId) {
      const existing = await prisma.space.findUniqueOrThrow({ where: { id: existingSpaceId } });

      if (existing.status === "active") {
        throw new TRPCError({ code: "CONFLICT", message: "이미 페어링된 상태입니다." });
      }

      if (existing.inviteCodeExpiresAt > new Date()) {
        return {
          inviteCode: existing.inviteCode,
          inviteCodeExpiresAt: existing.inviteCodeExpiresAt,
        };
      }

      // 코드가 만료됐을 뿐 Space 자체는 재사용 — 같은 Space에 새 코드만 발급
      const refreshed = await prisma.space.update({
        where: { id: existing.id },
        data: {
          inviteCode: generateInviteCode(),
          inviteCodeExpiresAt: inviteCodeExpiryDate(),
        },
      });
      return {
        inviteCode: refreshed.inviteCode,
        inviteCodeExpiresAt: refreshed.inviteCodeExpiresAt,
      };
    }

    const space = await prisma.$transaction(async (tx) => {
      const newSpace = await tx.space.create({
        data: {
          inviteCode: generateInviteCode(),
          inviteCodeExpiresAt: inviteCodeExpiryDate(),
        },
      });
      await tx.user.update({ where: { id: userId }, data: { spaceId: newSpace.id } });
      return newSpace;
    });

    return { inviteCode: space.inviteCode, inviteCodeExpiresAt: space.inviteCodeExpiresAt };
  }),
});
