// Google Translate 비공식 API를 사용한 번역

export async function translateText(text: string, from = "en", to = "ko"): Promise<string> {
  if (!text.trim()) return text;

  // 긴 텍스트는 분할 (Google Translate는 ~5000자 제한)
  const MAX_LEN = 4500;
  if (text.length > MAX_LEN) {
    const paragraphs = text.split("\n\n");
    const chunks: string[] = [];
    let current = "";

    for (const p of paragraphs) {
      if (current.length + p.length + 2 > MAX_LEN && current) {
        chunks.push(current);
        current = p;
      } else {
        current = current ? current + "\n\n" + p : p;
      }
    }
    if (current) chunks.push(current);

    const translated = [];
    for (const chunk of chunks) {
      translated.push(await translateText(chunk, from, to));
      // 요청 간 딜레이
      await new Promise((r) => setTimeout(r, 500));
    }
    return translated.join("\n\n");
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`번역 실패: HTTP ${res.status}`);

  const data = await res.json();

  // 응답 형식: [[["번역문","원문",null,null,10],...],null,"en"]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("번역 응답 파싱 실패");
  }

  return data[0]
    .filter((item: unknown[]) => item && item[0])
    .map((item: unknown[]) => item[0])
    .join("");
}
