import { SettingsSheet } from "./settings-sheet";

// 탭 상단 공통 바 - 왼쪽은 탭마다 다른 제목, 오른쪽은 항상 설정 시트를 여는
// 내 아바타(DESIGN.md §4).
export function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
      {children}
      <SettingsSheet />
    </header>
  );
}
