import { router } from "../init";
import { anniversaryRouter } from "./anniversary";
import { billingRouter } from "./billing";
import { calendarRouter } from "./calendar";
import { capsuleRouter } from "./capsule";
import { chatRouter } from "./chat";
import { countdownRouter } from "./countdown";
import { flightRouter } from "./flight";
import { geofenceRouter } from "./geofence";
import { homeRouter } from "./home";
import { healthRouter } from "./health";
import { locationRouter } from "./location";
import { meetupRouter } from "./meetup";
import { momentRouter } from "./moment";
import { pairingRouter } from "./pairing";
import { profileRouter } from "./profile";
import { pushRouter } from "./push";
import { questionRouter } from "./question";
import { realtimeRouter } from "./realtime";
import { streakRouter } from "./streak";
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
  realtime: realtimeRouter,
  geofence: geofenceRouter,
  meetup: meetupRouter,
  calendar: calendarRouter,
  moment: momentRouter,
  anniversary: anniversaryRouter,
  countdown: countdownRouter,
  capsule: capsuleRouter,
  streak: streakRouter,
  billing: billingRouter,
  home: homeRouter,
  question: questionRouter,
  flight: flightRouter,
});

export type AppRouter = typeof appRouter;
