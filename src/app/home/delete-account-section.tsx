"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { deleteAccountAction } from "../account/actions";

// 계정 삭제(설정 시트 맨 아래). 한 사람이 탈퇴하면 두 사람의 공간이 통째로
// 지워지므로(src/server/account-deletion.ts) 한 번 더 묻고, 무엇이 사라지는지
// 분명히 적는다. 되돌릴 수 없는 동작이라 버튼은 한 단계 눌러야 드러난다.
export function DeleteAccountSection({ partnerName }: { partnerName?: string }) {
  const t = useTranslations("account");
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteAccountAction, null);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground -mx-3.5"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-5" /> {t("delete")}
      </Button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-body"
      className="bg-destructive/10 flex flex-col gap-3 rounded-lg p-4"
    >
      <p id="delete-account-title" className="text-foreground font-medium">
        {t("confirmTitle")}
      </p>
      <div id="delete-account-body" className="text-muted-foreground flex flex-col gap-1 text-sm">
        <p>{partnerName ? t("confirmBodyPaired", { name: partnerName }) : t("confirmBody")}</p>
        <p>{t("confirmBilling")}</p>
      </div>
      {state?.failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("failed")}
        </p>
      )}
      <form action={action} className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending} className="flex-1">
          {pending ? t("deleting") : t("confirm")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t("cancel")}
        </Button>
      </form>
    </div>
  );
}
