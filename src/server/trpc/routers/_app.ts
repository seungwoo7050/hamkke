import { router } from "../init";
import { chatRouter } from "./chat";
import { healthRouter } from "./health";
import { locationRouter } from "./location";
import { pairingRouter } from "./pairing";
import { profileRouter } from "./profile";
import { pushRouter } from "./push";
import { touchRouter } from "./touch";
import { weatherRouter } from "./weather";

export const appRouter = router({
  health: healthRouter,
  pairing: pairingRouter,
  chat: chatRouter,
  touch: touchRouter,
  push: pushRouter,
  location: locationRouter,
  profile: profileRouter,
  weather: weatherRouter,
});

export type AppRouter = typeof appRouter;
