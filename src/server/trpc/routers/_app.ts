import { router } from "../init";
import { chatRouter } from "./chat";
import { healthRouter } from "./health";
import { pairingRouter } from "./pairing";
import { pushRouter } from "./push";
import { touchRouter } from "./touch";

export const appRouter = router({
  health: healthRouter,
  pairing: pairingRouter,
  chat: chatRouter,
  touch: touchRouter,
  push: pushRouter,
});

export type AppRouter = typeof appRouter;
