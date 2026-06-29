import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "오프라인 - 한해설",
  robots: { index: false, follow: false },
};

// 서비스워커가 오프라인일 때 보여주는 폴백 페이지(정적).
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-white">오프라인 상태예요</h1>
      <p className="mt-3 text-sm text-zinc-400">
        인터넷 연결을 확인한 뒤 다시 시도해주세요.
        <br />
        편성표는 실시간 데이터라 연결이 필요합니다.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
      >
        다시 시도
      </Link>
    </main>
  );
}
