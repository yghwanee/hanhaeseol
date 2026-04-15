import type { Metadata } from "next";
import Link from "next/link";
import { CoupangTopBanner } from "../_components/CoupangBanners";

export const metadata: Metadata = {
  title: "이용약관 - 한해설",
  description: "한해설 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline text-sm mb-8 inline-block">← 편성표로 돌아가기</Link>

        <h1 className="text-3xl font-bold mb-8">이용약관</h1>

        <p className="text-gray-400 text-sm mb-8">시행일: 2026년 2월 1일</p>

        <CoupangTopBanner />

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제1조 (목적)</h2>
          <p className="text-gray-300 leading-relaxed">
            이 약관은 한해설(이하 &ldquo;서비스&rdquo;)이 제공하는 스포츠 중계 편성표 정보 서비스의
            이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제2조 (서비스의 내용)</h2>
          <p className="text-gray-300 leading-relaxed mb-2">서비스는 다음을 제공합니다.</p>
          <ul className="text-gray-300 list-disc list-inside space-y-1 text-sm">
            <li>각 스포츠 중계 플랫폼의 편성표 통합 조회</li>
            <li>한국어 해설 제공 여부 표시</li>
            <li>종목별, 플랫폼별, 날짜별 필터링</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제3조 (서비스 이용)</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스는 별도의 회원가입 없이 누구나 무료로 이용할 수 있습니다.
            서비스는 웹 브라우저를 통해 제공되며, 이용자는 인터넷에 접속 가능한 환경에서 이용할 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제4조 (정보의 정확성)</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스에서 제공하는 편성표 정보는 각 플랫폼의 공식 편성표를 기반으로 자동 수집됩니다.
            편성표는 각 플랫폼의 사정에 따라 사전 고지 없이 변경될 수 있으며,
            서비스는 정보의 정확성을 보장하지 않습니다.
            실제 중계 여부는 해당 플랫폼에서 직접 확인하시기 바랍니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제5조 (지적재산권)</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스의 디자인, 소스코드, 로고 등 지적재산권은 서비스 운영자에게 있습니다.
            각 플랫폼의 명칭, 로고, 편성 정보 등에 대한 권리는 해당 플랫폼에 귀속됩니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제6조 (면책)</h2>
          <ul className="text-gray-300 list-disc list-inside space-y-2 text-sm leading-relaxed">
            <li>서비스는 편성표 정보를 제공하는 것이며, 중계 서비스 자체를 제공하지 않습니다.</li>
            <li>서비스 이용으로 발생하는 직접적, 간접적 손해에 대해 책임을 지지 않습니다.</li>
            <li>천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">제7조 (서비스 변경 및 중단)</h2>
          <p className="text-gray-300 leading-relaxed">
            서비스 운영자는 필요에 따라 서비스의 내용을 변경하거나 중단할 수 있습니다.
            서비스 변경 또는 중단 시 가능한 경우 사전에 공지합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">제8조 (약관의 변경)</h2>
          <p className="text-gray-300 leading-relaxed">
            이 약관은 필요에 따라 변경될 수 있으며, 변경된 약관은 서비스에 게시함으로써 효력이 발생합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
