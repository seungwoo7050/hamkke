import { router } from "../init";
import { healthRouter } from "./health";
import { pairingRouter } from "./pairing";

export const appRouter = router({
  health: healthRouter,
  pairing: pairingRouter,
});

export type AppRouter = typeof appRouter;
