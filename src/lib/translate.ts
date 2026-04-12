import { translate } from "@vitalets/google-translate-api";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_CHARS = 4000; // Google Translate 한 번에 보낼 수 있는 최대 글자수
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// 텍스트를 청크로 나누기 (문단 단위로, MAX_CHARS 이하)
function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current.length + p.length + 2 > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

async function translateChunk(text: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await translate(text, { to: "ko" });
      return result.text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Too Many Requests") && attempt < MAX_RETRIES) {
        console.log(`  번역 재시도 (${attempt}/${MAX_RETRIES})... ${RETRY_DELAY / 1000}초 대기`);
        await sleep(RETRY_DELAY * attempt);
        continue;
      }
      console.error(`번역 실패: ${text.slice(0, 50)}... (${msg})`);
      return text; // 실패 시 원문 반환
    }
  }
  return text;
}

export async function translateToKorean(text: string): Promise<string> {
  if (!text.trim()) return text;

  const chunks = splitIntoChunks(text);
  const translated: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await translateChunk(chunks[i]);
    translated.push(result);
    if (i < chunks.length - 1) await sleep(2000);
  }

  return translated.join("\n\n");
}
