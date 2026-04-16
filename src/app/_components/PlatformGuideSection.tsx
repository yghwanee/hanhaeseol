import { PlatformGuide } from "@/lib/platform-guides";

type Props = {
  guide: PlatformGuide;
  display: string;
};

export default function PlatformGuideSection({ guide, display }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-4">
        {display} 시청 가이드
      </h2>

      <dl className="space-y-3 text-sm">
        {guide.price && (
          <div className="flex gap-3">
            <dt className="text-zinc-500 shrink-0 w-16 sm:w-20">구독료</dt>
            <dd className="text-zinc-300">{guide.price}</dd>
          </div>
        )}
        {guide.freeOption && (
          <div className="flex gap-3">
            <dt className="text-zinc-500 shrink-0 w-16 sm:w-20">무료 옵션</dt>
            <dd className="text-green-400">{guide.freeOption}</dd>
          </div>
        )}
        {guide.channels && (
          <div className="flex gap-3">
            <dt className="text-zinc-500 shrink-0 w-16 sm:w-20">채널</dt>
            <dd className="text-zinc-300">{guide.channels.join(", ")}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="text-zinc-500 shrink-0 w-16 sm:w-20">중계 종목</dt>
          <dd className="text-zinc-300">{guide.sports.join(", ")}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-zinc-500 shrink-0 w-16 sm:w-20">시청 방법</dt>
          <dd className="text-zinc-300">{guide.howToWatch}</dd>
        </div>
      </dl>

      {guide.features && guide.features.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">주요 특징</p>
          <ul className="space-y-1">
            {guide.features.map((f, i) => (
              <li key={i} className="text-xs sm:text-sm text-zinc-400 flex items-start gap-1.5">
                <span className="text-zinc-600 mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guide.signupUrl && (
        <a
          href={guide.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {display} 바로가기 →
        </a>
      )}
    </section>
  );
}
