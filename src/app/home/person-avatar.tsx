import Image from "next/image";
import { cn } from "cn";

const SIZES = { 32: "size-8 text-sm", 48: "size-12 text-lg", 64: "size-16 text-2xl" } as const;

// DESIGN.md §9: 아바타는 32/48/64 세 사이즈만. 사진이 없으면 이름 첫 글자를
// 워드마크 색 체계(나=ember, 상대=dusk — 지도 마커와 같은 규칙)로 표시한다.
export function PersonAvatar({
  person,
  who,
  size = 32,
  fallback,
}: {
  person: { name: string | null; image: string | null } | null;
  who: "me" | "partner";
  size?: keyof typeof SIZES;
  fallback: string;
}) {
  const label = person?.name?.trim() || fallback;
  if (person?.image) {
    return (
      <Image
        src={person.image}
        alt={label}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 rounded-full object-cover", SIZES[size])}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        SIZES[size],
        who === "me" ? "bg-ember text-zinc-900" : "bg-dusk text-zinc-50",
      )}
    >
      {label.slice(0, 1)}
    </span>
  );
}
