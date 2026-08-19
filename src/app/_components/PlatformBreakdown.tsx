/**
 * 플랫폼별 경기 수 막대.
 *
 * "어디서 보나" 에 대한 정량 답이다. 팀 페이지(작업58)에 인라인으로 있던 것을
 * 종목 페이지에서도 쓰려고 컴포넌트로 뽑았다 — 마크업은 그대로다.
 */
export type PlatformCount = { platform: string; count: number };

export function PlatformBreakdown({
  items,
  title = "중계 플랫폼별 경기 수",
  limit = 5,
}: {
  items: PlatformCount[];
  title?: string;
  limit?: number;
}) {
  if (items.length === 0) return null;
  const top = items.slice(0, limit);
  const max = top[0].count;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-2 space-y-1.5">
        {top.map((b) => (
          <li key={b.platform} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-zinc-300">{b.platform}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <span
                className="block h-full rounded-full bg-emerald-600/70"
                style={{ width: `${Math.round((b.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">{b.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
