import { field, type LegalDocFactory } from "./types";

// Terms of service (English). The Korean version is authoritative; keep both in step.
const termsEn: LegalDocFactory = (op, missing) => ({
  title: "Terms of service",
  intro: `These terms set out how you can use Hamkke, run by ${field(op.name, missing)} ("we"). By signing up you agree to them. If this English version and the Korean version differ, the Korean version applies.`,
  sections: [
    {
      heading: "1. The service",
      blocks: [
        "Hamkke is a shared space for two people who live apart: chat, keep your memories, and, if you choose, share where you are and what time it is for each other. It's available on the web and as an Android app.",
      ],
    },
    {
      heading: "2. Signing up and your space",
      blocks: [
        {
          list: [
            "You must be 14 or older.",
            "Your space exists once one of you makes an invite code and the other enters it. Each person belongs to one space.",
            "Both of you see what's in the space. Don't add anything you don't want your partner to see.",
            "Don't sign up with someone else's email or account.",
          ],
        },
      ],
    },
    {
      heading: "3. What you must not do",
      blocks: [
        {
          list: [
            "Try to find out your partner's location without their consent, or use the app to watch or control them",
            "Upload anything illegal, such as photos or videos that infringe others' rights or were taken without consent",
            "Hack the service, flood it with automated requests or try to get into someone else's space",
          ],
        },
        "If we find this kind of use, we may suspend or delete the account.",
      ],
    },
    {
      heading: "4. Your content",
      blocks: [
        "You own what you upload: messages, photos, videos, voice messages. We only use it as needed to run the service: storing it, sending it to your partner and displaying it.",
      ],
    },
    {
      heading: "5. Free plan and Premium",
      blocks: [
        {
          list: [
            "The free plan has limits on photos and videos, scheduled letters, saved places and storage. You can see them in Settings.",
            "Premium is a subscription for your space, so if one of you subscribes you both get it. Before we start selling Premium, we'll show the price and benefits in the app.",
            "You can cancel at any time and keep Premium until the end of the period you paid for.",
            "Withdrawals and refunds follow Korea's e-commerce consumer protection law and the policy of the store or payment processor you paid through.",
            "When Premium ends we don't delete what you've added, but while you're over a free limit you may not be able to add more and some items may be hidden.",
          ],
        },
      ],
    },
    {
      heading: "6. Deleting your account",
      blocks: [
        "You can delete your account in Settings at any time. When either of you deletes their account, your shared space and every record and file in it are deleted right away and can't be restored. Your partner is notified.",
      ],
    },
    {
      heading: "7. Changes to the service",
      blocks: [
        "We may change or improve the service. If we have to shut it down, we'll tell you in the app 30 days in advance.",
      ],
    },
    {
      heading: "8. Liability",
      blocks: [
        "We work to keep the service running, but we aren't liable for losses caused by things outside our control, such as natural disasters or network and third-party outages. We are liable as the law requires for losses caused by our intent or gross negligence. Location, distance, weather and flight times depend on your device and outside sources and may not be exact.",
      ],
    },
    {
      heading: "9. Disputes",
      blocks: [
        `These terms are governed by the laws of South Korea. Contact: ${field(op.email, missing)}`,
      ],
    },
    {
      heading: "10. Changes to these terms",
      blocks: [
        `We'll tell you in the app and on this page 7 days before a change takes effect (30 days if it's less favorable to you). Effective date: ${field(op.effectiveDate, missing)}`,
      ],
    },
  ],
});

export default termsEn;
