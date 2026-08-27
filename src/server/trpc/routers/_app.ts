import { router } from "../init";
import { chatRouter } from "./chat";
import { healthRouter } from "./health";
import { pairingRouter } from "./pairing";
import { touchRouter } from "./touch";

export const appRouter = router({
  health: healthRouter,
  pairing: pairingRouter,
  chat: chatRouter,
  touch: touchRouter,
});

export type AppRouter = typeof appRouter;
