import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

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
