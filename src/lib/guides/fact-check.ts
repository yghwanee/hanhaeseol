import { roundInfo, type SeriesStatus } from "@/lib/kbo-postseason";
import { withJosa } from "@/lib/josa";

/**
 * 토픽 글 사실 게이트 — 이미 끝난 시리즈를 「진행 중」으로 쓴 문장을 잡는다.
 *
 * 🔴 왜 (2026-10-22): 「삼성 라이온즈, 2위로 플레이오프에서 기다린다」가 10/22 에 발행됐는데
 * 본문이 「준플레이오프는 … 2차전까지 KIA가 앞서고 있는 상황이다」였다. KIA 는 10/20 에 3:0 으로
 * 이미 끝냈다. 초안은 며칠 앞서 쓰이고 발행은 큐 날짜에 되니, 그 사이 끝난 시리즈를 못 따라간다.
 *
 * 일부러 좁게 잡는다: 라운드 이름이 들어간 문장에 진행형 표현이 있고, 그 라운드가 결과 데이터상
 * 끝났을 때만. 오탐으로 발행이 막히면 그게 더 비싸다(글감 큐가 하루 밀린다).
 */
const ONGOING = /(진행\s*중|치르고\s*있|앞서고\s*있|앞서\s*있|\d차전까지|맞붙고\s*있|이어지고\s*있)/;

export function staleSeriesClaims(text: string, statuses: SeriesStatus[]): string[] {
  const out: string[] = [];
  const sentences = text.replace(/\r/g, "").split(/(?<=[.!?다])\s+|\n+/);
  for (const st of statuses) {
    if (!st.winner) continue;
    const name = roundInfo(st.round).name;
    const short = name.replace(/ 결정전$/, "");
    for (const s of sentences) {
      if (!s.includes(short) || !ONGOING.test(s)) continue;
      out.push(`${withJosa(name, "은/는")} ${st.winner} ${st.wins[st.winner]}승으로 이미 끝났다 — 「${s.trim().slice(0, 80)}」`);
    }
  }
  return out;
}
