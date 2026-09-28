// 탭(우리/대화/기억)을 옮길 때마다 새로 마운트되는 경계 - layout.tsx와 달리
// 전환마다 다시 그려지므로 들어오는 화면의 전환 모션을 여기 건다(globals.css
// .tab-enter). layout의 스크롤 영역 안에서 세로로 꽉 차야 대화 화면이 버틴다.
export default function HomeTemplate({ children }: { children: React.ReactNode }) {
  return <div className="tab-enter flex min-h-0 flex-1 flex-col">{children}</div>;
}
