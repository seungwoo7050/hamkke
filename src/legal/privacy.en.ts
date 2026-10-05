import { field, type LegalDocFactory } from "./types";

const SENTRY_REGION = { us: "US", de: "Germany (EU)" } as const;

// Privacy policy (English). The Korean version is authoritative; keep both in step.
const privacyEn: LegalDocFactory = (op, missing) => ({
  title: "Privacy policy",
  intro: `${field(op.name, missing)} ("we") runs Hamkke. This policy explains what personal information we collect from the two of you, why, how long we keep it and who helps us process it. If this English version and the Korean version differ, the Korean version applies.`,
  sections: [
    {
      heading: "1. Why we use your information",
      blocks: [
        {
          list: [
            "To sign you up, sign you in and connect the two of you with an invite code",
            "To store the things you share (chats, photos and videos, dates, plans, letters) and show them to each other",
            "If you turn on location sharing: distance, local weather, arrival alerts and the “see you soon” view",
            "To send push notifications",
            "Once Premium is on sale: payments and subscriptions",
            "To prevent abuse and answer your questions",
          ],
        },
      ],
    },
    {
      heading: "2. What we collect",
      blocks: [
        {
          table: {
            head: ["Category", "Items"],
            rows: [
              [
                "Sign-up and sign-in (required)",
                "Email address. With Google sign-in: your Google account name, email and profile photo",
              ],
              [
                "Using the app (what you add)",
                "Chat messages, photo, video and voice files with captions, anniversaries, plans, countdowns, letters, answers to the daily question, places you met (name and coordinates), flights (number, airports, times), touches",
              ],
              [
                "Location (only while sharing is on)",
                "Your device's current coordinates and accuracy, and the name and coordinates of arrival-alert places. See the location-based service terms",
              ],
              [
                "Device and settings (automatic)",
                "Time zone, language setting, device language, push token, sign-in session cookie, IP address for abuse prevention, error reports when something breaks (the error, device and browser type, the address requested, your member ID)",
              ],
              [
                "Payments (once Premium is on sale and you subscribe)",
                "Your customer ID and subscription status at our payment processor (Stripe). We never receive your card number",
              ],
            ],
          },
        },
        "You must be 14 or older to sign up.",
      ],
    },
    {
      heading: "3. How long we keep it",
      blocks: [
        {
          list: [
            "Your account and everything the two of you share: until you delete your account. When either of you deletes their account, the shared space and every record and file in it are deleted right away.",
            "Location coordinates: deleted 7 days after we receive them, and right away when you turn sharing off.",
            "Records of when your location was shared: kept for 6 months as required by Korea's Location Information Act, then deleted. Deleted right away when you turn sharing off (withdrawing consent).",
            "Abuse-prevention records (such as IP addresses): deleted once the limit window (at most a day) has passed.",
            "Error reports: deleted when our error-tracking provider's (Sentry) retention period (at most 90 days) ends.",
            "Payment records: 5 years under Korea's e-commerce consumer protection law, kept as our payment processor's (Stripe) records.",
          ],
        },
      ],
    },
    {
      heading: "4. Sharing with others",
      blocks: [
        "We don't sell or hand over your information. Your partner seeing what you share, and your location if you've agreed to it, is how the app works. We may disclose information when the law requires it, for example to investigators.",
      ],
    },
    {
      heading: "5. Service providers and international transfers",
      blocks: [
        "These companies process information for us. Providers outside Korea receive it over the network while you use the app, and it is deleted when the contract ends or you delete your account.",
        {
          table: {
            head: ["Provider", "What they do", "Where", "What they receive"],
            rows: [
              [
                "Supabase",
                "Database, real-time delivery",
                "South Korea (Seoul)",
                "Everything in section 2",
              ],
              [
                "Cloudflare",
                "Storing photo, video and voice files",
                "US and elsewhere",
                "Files you upload",
              ],
              [
                "Vercel",
                "Running our servers",
                "US and elsewhere",
                "Data passing through requests",
              ],
              ["Google (Firebase)", "Push notifications", "US", "Push token, notification text"],
              ["Google", "Google sign-in", "US", "Sign-in details"],
              ["Resend", "Sign-in emails", "US", "Email address"],
              ["Stripe", "Payments (once Premium is on sale)", "US", "Payment details, email"],
              [
                "Sentry",
                "Error tracking (finding what broke)",
                op.sentryRegion ? SENTRY_REGION[op.sentryRegion] : missing,
                "The error, device and browser type, the address requested, your member ID (names, emails, messages, location and IP addresses are removed before sending)",
              ],
              [
                "Open-Meteo",
                "Local weather",
                "Switzerland, Germany and elsewhere",
                "Coordinates only, with no name or account",
              ],
              [
                "OpenStreetMap",
                "Map images",
                "UK and elsewhere",
                "Your device's IP address and the map area you're viewing",
              ],
            ],
          },
        },
        "If you don't want your information transferred abroad, you can delete your account. We can't run the app without these providers.",
      ],
    },
    {
      heading: "6. How we delete it",
      blocks: [
        "When a retention period ends or you delete your account, we delete the database records so they can't be restored, together with the stored files.",
      ],
    },
    {
      heading: "7. Your rights",
      blocks: [
        "You can ask to see, correct or delete your information, or to stop processing it, at any time. In Settings you can change your name and language, turn off location sharing and delete your account. If you can't use the app, use the account deletion page (/account/delete) or contact us below. We'll act without delay.",
      ],
    },
    {
      heading: "8. How we keep it safe",
      blocks: [
        {
          list: [
            "All traffic is encrypted with HTTPS.",
            "Only our servers can reach the database.",
            "Photo, video and voice files have no public address; they're shown to the two of you through short-lived links.",
            "No one outside your space can see your records.",
          ],
        },
      ],
    },
    {
      heading: "9. Cookies",
      blocks: [
        "We only use a cookie that keeps you signed in. No advertising or tracking cookies or tools. If you block cookies, you can't sign in.",
      ],
    },
    {
      heading: "10. Privacy officer",
      blocks: [
        {
          list: [
            `Officer: ${field(op.representative, missing)}`,
            `Email: ${field(op.email, missing)}`,
          ],
        },
        "You can also contact Korea's Personal Information Infringement Report Center (privacy.kisa.or.kr, 118) or the Personal Information Dispute Mediation Committee (kopico.go.kr, 1833-6972).",
      ],
    },
    {
      heading: "11. Changes",
      blocks: [
        `We'll tell you in the app and on this page 7 days before a change takes effect. Effective date: ${field(op.effectiveDate, missing)}`,
      ],
    },
  ],
});

export default privacyEn;
