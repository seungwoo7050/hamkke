import { field, type LegalDocFactory } from "./types";

// Location-based service terms (English). The Korean version is authoritative; keep both
// in step, and keep retention and notice rules in step with the location router.
const locationEn: LegalDocFactory = (op, missing) => ({
  title: "Location-based service terms",
  intro: `These terms cover the location features of Hamkke, run by ${field(op.name, missing)} ("we"), under Korea's Act on the Protection and Use of Location Information. Location sharing is off by default and only starts when you agree to these terms and turn it on yourself. If this English version and the Korean version differ, the Korean version applies.`,
  sections: [
    {
      heading: "1. What it does",
      blocks: [
        "With location sharing on, your location is used to:",
        {
          list: [
            "Show your partner where you are on a map",
            "Show the distance between you, and “see you soon” when you're close",
            "Show the local weather where you are",
            "Let your partner know when you arrive at a place you saved (such as home or the airport)",
          ],
        },
      ],
    },
    {
      heading: "2. How we collect it",
      blocks: [
        "While sharing is on and the app is open, it sends your device's location (coordinates and accuracy worked out by your device from GPS, Wi-Fi and cell towers) to us. It doesn't send anything while the app is closed. Once you turn sharing off, we stop receiving it.",
      ],
    },
    {
      heading: "3. Sharing with your partner (a third party you choose)",
      blocks: [
        {
          table: {
            head: ["Who receives it", "Why", "What"],
            rows: [
              [
                "The one person you connected with by invite code, in the same space",
                "To feel close by seeing each other's location and distance, and arrival alerts",
                "Your most recent coordinates and when we received them, and that you arrived at a saved place",
              ],
            ],
          },
        },
        "We don't give your location to anyone else. To look up your local weather we send coordinates only, with no name or account details, to our weather provider (Open-Meteo).",
      ],
    },
    {
      heading: "4. Telling you when it's shared",
      blocks: [
        "The law says we must tell you each time your location goes to your partner. Because sharing happens every few minutes, telling you each time would mean constant notifications. With your consent we instead bundle 30 days of sharing (who received it, the period, how many times and why) into one notice. You can't turn on sharing without this consent.",
      ],
    },
    {
      heading: "5. Why and how long we keep it",
      blocks: [
        {
          list: [
            "Location coordinates: kept for 7 days to run the features in section 1, then deleted. The app only uses the latest one.",
            "Arrival-alert places: kept until you delete them.",
            "Records of when and to whom your location was shared: recorded automatically and kept for 6 months under Article 16(2) of the Act, then deleted.",
            "When you turn sharing off (withdrawing consent) or delete your account, all of the above is deleted right away.",
          ],
        },
      ],
    },
    {
      heading: "6. Your rights",
      blocks: [
        {
          list: [
            "You can withdraw all or part of your consent at any time by turning off location sharing in Settings.",
            "You can pause the use and sharing of your location (turn sharing off).",
            "You can ask to see the records of how your location was used and shared, or to correct them. Contact us below and we'll act without delay.",
          ],
        },
        "Since you must be 14 or older to sign up, there's no guardian consent process, and we don't provide location services for children aged 8 or under through a guardian's consent.",
      ],
    },
    {
      heading: "7. Who we are",
      blocks: [
        {
          list: [
            `Business name: ${field(op.name, missing)}`,
            `Address: ${field(op.address, missing)}`,
            `Business registration number: ${field(op.businessNumber, missing)}`,
            `Location information officer: ${field(op.representative, missing)}`,
            `Email: ${field(op.email, missing)}`,
          ],
        },
      ],
    },
    {
      heading: "8. Compensation and disputes",
      blocks: [
        "If we break the Act and you suffer a loss, we'll compensate you as the law requires. You can bring location-related disputes to the Korea Communications Commission or the Personal Information Dispute Mediation Committee (kopico.go.kr, 1833-6972).",
      ],
    },
    {
      heading: "9. Changes to these terms",
      blocks: [
        `We'll tell you in the app and on this page 7 days before a change takes effect. Effective date: ${field(op.effectiveDate, missing)}`,
      ],
    },
  ],
});

export default locationEn;
