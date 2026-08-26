import { router } from "../init";
import { chatRouter } from "./chat";
import { healthRouter } from "./health";
import { pairingRouter } from "./pairing";

export const appRouter = router({
  health: healthRouter,
  pairing: pairingRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
