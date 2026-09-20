import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkWithinLimit } from "@/server/magic-link-limit";

// 기본 Resend 발송 구현(Auth.js) — 횟수 제한을 통과한 요청만 여기로 넘긴다.
const defaultResendSend = Resend({}).sendVerificationRequest;

// spaceId는 tRPC 미들웨어(src/server/trpc/init.ts)의 spaceProcedure가
// 매 요청마다 읽는 값이라 세션에 직접 실어둔다(DB 재조회 없이 확인 가능하게).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      spaceId: string | null;
      /** 화면·알림 언어(PRD §3.8). 세션에 실어 언어 결정 때 DB를 다시 읽지 않는다. */
      locale?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    spaceId: string | null;
    locale: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET 컨벤션 이름이면 Auth.js가 자동으로 읽는다
    Google,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
      // 여기서 막아야 로그인 화면을 거치지 않고 Auth.js 엔드포인트로 바로 보내는
      // 요청까지 막힌다. 화면은 같은 한도를 미리 읽어 안내한다(src/app/login).
      sendVerificationRequest: (params) => sendMagicLinkWithinLimit(params, defaultResendSend),
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.spaceId = user.spaceId;
      session.user.locale = user.locale;
      return session;
    },
  },
});
