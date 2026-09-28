import { LoadingMotif } from "@/components/brand/loading-motif";

// 탭 전환 중 - 기본 스피너 대신 브랜드 모티프(DESIGN.md §8).
export default function Loading() {
  return <LoadingMotif className="flex-1 justify-center" />;
}
