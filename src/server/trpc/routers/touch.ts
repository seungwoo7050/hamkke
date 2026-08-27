import { prisma } from "@/lib/prisma";
import { spaceChannelName } from "@/lib/supabase/channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { router, spaceProcedure } from "../init";

export const touchRouter = router({
  send: spaceProcedure.mutation(async ({ ctx }) => {
    const touch = await prisma.touch.create({
      data: { spaceId: ctx.space.id, senderId: ctx.session.user.id },
    });

    const supabase = createSupabaseServerClient();
    await supabase.channel(spaceChannelName(ctx.space.id)).send({
      type: "broadcast",
      event: "touch",
      payload: touch,
    });

    return touch;
  }),
});
