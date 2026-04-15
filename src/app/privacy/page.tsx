import type { Metadata } from "next";
import Link from "next/link";
import { CoupangTopBanner } from "../_components/CoupangBanners";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 한해설",
  description: "한해설 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline text-sm mb-8 inline-block">← 편성표로 돌아가기</Link>

        <h1 className="text-3xl font-bold mb-8">개인정보처리방침</h1>

        <p className="text-gray-400 text-sm mb-8">시행일: 2026년 2월 1일</p>

        <CoupangTopBanner />

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. 개인정보의 수집 및 이용</h2>
          <p className="text-gray-300 leading-relaxed">
            한해설(이하 &ldquo;서비스&rdquo;)은 별도의 회원가입 절차가 없으며,
            이용자로부터 개인정보를 직접 수집하지 않습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. 자동 수집 정보</h2>
          <p className="text-gray-300 leading-relaxed mb-2">
            서비스 이용 과정에서 아래 정보가 자동으로 생성되어 수집될 수 있습니다.
          </p>
          <ul className="text-gray-300 list-disc list-inside space-y-1 text-sm">
            <li>방문 일시, 접속 IP, 브라우저 유형, 운영체제 정보</li>
            <li>방문 페이지, 이용 시간 등 서비스 이용 기록</li>
          </ul>
          <p className="text-gray-300 leading-relaxed mt-2">
            이 정보는 Google Analytics를 통해 서비스 개선 및 이용 통계 분석 목적으로만 활용됩니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. 쿠키 사용</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스는 Google Analytics 및 Google AdSense를 위해 쿠키를 사용할 수 있습니다.
            이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며,
            이 경우 서비스 이용에는 영향이 없습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. 광고</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스는 Google AdSense를 통해 광고를 게재할 수 있습니다.
            Google AdSense는 이용자의 관심사에 기반한 광고를 제공하기 위해 쿠키를 사용할 수 있으며,
            이에 대한 자세한 내용은{" "}
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Google 광고 정책
            </a>
            에서 확인할 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. 개인정보의 제3자 제공</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 법률에 의해 요구되는 경우에는 관련 법령에 따라 제공될 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. 개인정보의 보유 및 파기</h2>
          <p className="text-gray-300 leading-relaxed">
            자동 수집된 정보는 수집 목적이 달성되면 지체 없이 파기합니다.
            Google Analytics 데이터 보존 기간은 Google의 정책에 따릅니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. 문의</h2>
          <p className="text-gray-300">
            개인정보 관련 문의는{" "}
            <a href="mailto:yghwanee@gmail.com" className="text-blue-400 hover:underline">
              yghwanee@gmail.com
            </a>
            으로 연락해 주세요.
          </p>
        </section>
      </div>
    </main>
  );
}
