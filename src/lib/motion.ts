// DESIGN.md §3.4: 스프링이 필요한 모션은 이 프리셋 하나로 통일한다 —
// 컴포넌트마다 stiffness/damping을 새로 튜닝하지 않는다.
export const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
