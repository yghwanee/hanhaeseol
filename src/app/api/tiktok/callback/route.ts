import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const html = renderHtml({ code, state, error, errorDescription });
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(p: {
  code: string | null;
  state: string;
  error: string | null;
  errorDescription: string | null;
}): string {
  const body = p.error
    ? `<h1 style="color:#dc2626">인증 실패</h1>
       <p><strong>error:</strong> ${escape(p.error)}</p>
       <p><strong>description:</strong> ${escape(p.errorDescription)}</p>`
    : p.code
      ? `<h1>✅ TikTok 인증 코드 발급 완료</h1>
         <p>아래 코드를 복사해서 터미널의 <code>npm run tiktok:setup</code> 스크립트에 붙여넣으세요.</p>
         <p>state: <code>${escape(p.state)}</code></p>
         <h2>code</h2>
         <pre style="background:#0a0a0a;color:#e5e5e5;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;font-size:14px;">${escape(p.code)}</pre>
         <button onclick="navigator.clipboard.writeText(${JSON.stringify(p.code)}).then(()=>this.textContent='복사됨 ✓')" style="margin-top:12px;padding:8px 16px;border-radius:6px;border:1px solid #444;background:#171717;color:#fff;cursor:pointer;">복사</button>`
      : `<h1>대기 중</h1>
         <p>이 페이지는 한해설 TikTok OAuth 콜백 핸들러입니다. 직접 접속할 수 없으며, TikTok 인증 흐름에서만 사용됩니다.</p>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>한해설 - TikTok OAuth 콜백</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background:#0a0a0a; color:#e5e5e5; padding:32px; max-width:720px; margin:0 auto; }
  h1 { font-size:24px; margin-bottom:16px; }
  h2 { font-size:14px; color:#999; margin-top:24px; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em; }
  code { background:#171717; padding:2px 6px; border-radius:4px; }
</style>
</head>
<body>${body}</body>
</html>`;
}
