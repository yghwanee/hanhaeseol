import type { CommentatorSource } from "@/lib/commentators";
import { commentatorSentence } from "@/lib/commentators";

type Props = {
  title: string;
  checkedOn: string;
  sources: CommentatorSource[];
};

/**
 * 방송사 공식 해설진 명단. 데이터·근거는 `src/lib/commentators.ts`.
 * 첫 문장은 답변엔진이 잘라 가는 단위라 [기준일 + 방송사 + 명단]을 한 문장에 담는다.
 */
export default function CommentatorSection({ title, checkedOn, sources }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-2 text-body1 font-semibold text-fg-strong sm:text-headline1">{title}</h2>
      {sources.map((s) => (
        <div key={s.platform} className="mt-2 first:mt-0">
          <p className="break-keep text-label1 leading-relaxed text-fg-secondary">
            {commentatorSentence(s, checkedOn)}
          </p>
          <dl className="mt-3 space-y-2 text-label1">
            {s.groups.map((g) => (
              <div key={g.label} className="flex gap-3">
                <dt className="w-20 shrink-0 text-fg-tertiary sm:w-24">{g.label}</dt>
                <dd className="break-keep text-fg">{g.names.join(" · ")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 break-keep text-caption1 text-fg-tertiary">
            경기별 해설 배정은 방송사가 편성표에 미리 싣지 않습니다. 명단 출처:{" "}
            <a
              href={s.sourceUrl}
              target="_blank"
              rel="noopener nofollow"
              className="text-fg-secondary underline underline-offset-2 hover:text-fg-strong"
            >
              {s.platform} 공식 홈페이지
            </a>
          </p>
        </div>
      ))}
    </section>
  );
}
