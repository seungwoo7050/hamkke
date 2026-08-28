import { prisma } from "@/lib/prisma";
import { sendPushToSpacePartner } from "@/lib/push";
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

    // 상대가 탭을 닫아뒀거나 백그라운드에 있어도 받을 수 있도록 푸시도 시도한다.
    // 푸시 발송 실패가 터치 자체의 성공을 막으면 안 되므로 에러는 삼킨다.
    await sendPushToSpacePartner(ctx.space.id, ctx.session.user.id, {
      title: "Hamkke",
      body: "상대방이 생각하고 있어요",
    }).catch(() => {});

    return touch;
  }),
});
