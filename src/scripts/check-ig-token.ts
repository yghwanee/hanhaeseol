const IG_API = 'https://graph.facebook.com/v21.0';

async function main() {
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_PAGE_ACCESS_TOKEN;

  if (!igId || !token) {
    console.error('❌ IG_BUSINESS_ACCOUNT_ID 또는 IG_PAGE_ACCESS_TOKEN 환경변수가 없습니다.');
    process.exit(1);
  }

  const url = `${IG_API}/${igId}?fields=id,username&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    console.error('❌ 토큰 검증 실패:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`✅ 토큰 정상. 연결된 계정: @${data.username} (ID: ${data.id})`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
