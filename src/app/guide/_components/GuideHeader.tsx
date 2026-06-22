import Image from "next/image";
import Link from "next/link";

/**
 * 가이드(한해설 Topic) 페이지 공용 헤더.
 * 메인 편성표 헤더와 동일한 로고/타이틀 + 우측에 '편성표로' 돌아가는 버튼.
 */
export function GuideHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-end" aria-label="한해설 홈">
        <Image
          src="/icon.png"
          alt="한해설 아이콘"
          width={32}
          height={32}
          className="h-6 w-6 self-center sm:h-8 sm:w-8"
        />
        <span className="ml-1 text-xl font-bold text-white sm:ml-2 sm:text-3xl">
          한해설
        </span>
        <span className="ml-2 text-sm font-normal text-zinc-500 sm:ml-3 sm:text-base">
          한국어 해설 중계 편성표
        </span>
      </Link>
      <Link
        href="/"
        aria-label="편성표로 가기"
        className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs"
      >
        ← 편성표
      </Link>
    </header>
  );
}
