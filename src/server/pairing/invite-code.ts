import { randomInt } from "node:crypto";

// 혼동되는 문자(0/O, 1/I/L) 제외 — 사람이 직접 타이핑해서 공유하는 코드이므로.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
export const INVITE_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function inviteCodeExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_CODE_TTL_MS);
}
