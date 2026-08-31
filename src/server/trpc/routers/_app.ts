import { router } from "../init";
import { calendarRouter } from "./calendar";
import { chatRouter } from "./chat";
import { geofenceRouter } from "./geofence";
import { healthRouter } from "./health";
import { locationRouter } from "./location";
import { meetupRouter } from "./meetup";
import { momentRouter } from "./moment";
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
  geofence: geofenceRouter,
  meetup: meetupRouter,
  calendar: calendarRouter,
  moment: momentRouter,
});

export type AppRouter = typeof appRouter;
