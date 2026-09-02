/**
 * 텔레그램 텍스트 전송. 게시 스크립트 계열의 단일 창구다.
 *
 * 🔴 `curl -s` 든 `fetch` 든 **응답의 `ok`를 안 보면 조용히 실패한다.** 이 레포에서
 * 같은 함정에 두 번 걸렸다: 2026-07-26 글감 알림이 4096자 초과로 400 을 받고도
 * 워크플로는 초록이었고(작업61), 2026-08-03 에도 두 곳이 같은 이유로 무성 실패했다(작업78).
 * 그래서 전송 실패는 여기서 throw 한다. 알릴 수 없으면 스텝이 빨간불이어야 한다.
 */
const LIMIT = 4000;

export async function sendTelegramText(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음");

  // 본문 한도는 4096자. 에러 메시지가 길어질 수 있어 자른다.
  const body = text.length > LIMIT ? `${text.slice(0, LIMIT - 10)}\n…(생략)` : text;
  // fetch-cache-ok: GH Actions 전용 스크립트라 Next 런타임 캐시와 무관하다.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
  if (!res.ok || json.ok !== true) {
    throw new Error(`Telegram 전송 실패: ${res.status} ${JSON.stringify(json)}`);
  }
}

/** 설정이 없으면 조용히 넘어간다(로컬 실행). 있으면 위와 같이 엄격하게 보낸다. */
export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}
