import { protectedProcedure, publicProcedure, router } from "../init";

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, timestamp: Date.now() })),
  whoami: protectedProcedure.query(({ ctx }) => ctx.session.user),
});
