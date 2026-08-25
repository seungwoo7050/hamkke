import "server-only";
import { auth } from "@/auth";

export async function createTRPCContext() {
  const session = await auth();
  return { session };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
