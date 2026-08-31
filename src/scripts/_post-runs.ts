/**
 * GH Actions 실행 목록을 가져와 **각 실행이 실제로 게시했는지** 스텝으로 판정한다.
 *
 * check-post-cycle(게이트) 과 post-catchup(따라잡기) 이 같은 판정을 써야 한다.
 * 한쪽만 다르게 세면, 따라잡기가 발동시킨 실행이 게이트에 걸려 죽는다.
 */
import { LOOKBACK_HOURS, runDidPost, type OtherRun } from "../lib/post-duplicate";

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

export function ghReady(): boolean {
  return Boolean(REPO && TOKEN);
}

export async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  // fetch-cache-ok: GH Actions 전용 스크립트라 Next 런타임 캐시와 무관하다.
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: "application/vnd.github+json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface RawRun extends OtherRun {
  id: number;
}

/**
 * 🔴 conclusion=success 만으로는 안 된다. 사이클 검사에 걸려 스킵된 실행도
 * success 로 끝난다(2026-08-30). 그걸 "이미 올렸다"고 세면 스킵이 다음 스킵을 부른다.
 *
 * @param excludeRunId 지금 실행 자신(있으면)
 */
export async function fetchPostRuns(wf: string, excludeRunId = ""): Promise<OtherRun[]> {
  const data = await gh<{ workflow_runs?: RawRun[] }>(
    `/repos/${REPO}/actions/workflows/${wf}/runs?per_page=10&status=completed`,
  );
  const runs = (data.workflow_runs ?? []).filter((r) => String(r.id) !== excludeRunId);
  const recent = runs.filter((r) => {
    const t = new Date(r.run_started_at).getTime();
    return Number.isFinite(t) && t >= Date.now() - LOOKBACK_HOURS * 3600_000;
  });
  return Promise.all(
    recent.map(async (r) => {
      if (r.conclusion !== "success") return r;
      try {
        const jobs = await gh<{ jobs?: { steps?: { name?: string; conclusion?: string }[] }[] }>(
          `/repos/${REPO}/actions/runs/${r.id}/jobs?per_page=20`,
        );
        const steps = (jobs.jobs ?? []).flatMap((j) => j.steps ?? []);
        // 스텝을 못 읽었으면 판정하지 않는다(=게시한 것으로 본다).
        return steps.length === 0 ? r : { ...r, posted: runDidPost(steps) };
      } catch {
        return r;
      }
    }),
  );
}
