import { PlatformGuide } from "@/lib/platform-guides";

type Props = {
  guide: PlatformGuide;
  display: string;
};

export default function PlatformGuideSection({ guide, display }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-body1 sm:text-headline1 font-semibold text-fg-strong mb-4">
        {display} 시청 가이드
      </h2>

      <dl className="space-y-3 text-label1">
        {guide.price && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-16 sm:w-20">구독료</dt>
            <dd className="text-fg">{guide.price}</dd>
          </div>
        )}
        {guide.freeOption && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-16 sm:w-20">무료 옵션</dt>
            <dd className="text-fg-brand-bright">{guide.freeOption}</dd>
          </div>
        )}
        {guide.channels && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-16 sm:w-20">채널</dt>
            <dd className="text-fg">{guide.channels.join(", ")}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="text-fg-tertiary shrink-0 w-16 sm:w-20">중계 종목</dt>
          <dd className="text-fg">{guide.sports.join(", ")}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-fg-tertiary shrink-0 w-16 sm:w-20">시청 방법</dt>
          <dd className="text-fg">{guide.howToWatch}</dd>
        </div>
      </dl>

      {guide.features && guide.features.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line-subtle">
          <p className="text-caption1 text-fg-tertiary mb-2">주요 특징</p>
          <ul className="space-y-1">
            {guide.features.map((f, i) => (
              <li key={i} className="text-caption1 sm:text-label1 text-fg-secondary flex items-start gap-1.5">
                <span className="text-fg-tertiary mt-0.5">•</span>
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
          className="-my-2 inline-block py-2 mt-4 inline-flex items-center gap-1 text-caption1 sm:text-label1 text-fg-brand hover:text-fg-brand-bright transition-colors"
        >
          {display} 바로가기 →
        </a>
      )}
    </section>
  );
}
