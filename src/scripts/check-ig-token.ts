const IG_API = 'https://graph.facebook.com/v21.0';

const REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_read_engagement',
];

async function main() {
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_PAGE_ACCESS_TOKEN;

  if (!igId || !token) {
    console.error('❌ IG_BUSINESS_ACCOUNT_ID 또는 IG_PAGE_ACCESS_TOKEN 환경변수가 없습니다.');
    process.exit(1);
  }

  const res = await fetch(`${IG_API}/${igId}?fields=id,username&access_token=${token}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error('❌ 토큰 검증 실패:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(`✅ 토큰 정상. 연결된 계정: @${data.username} (ID: ${data.id})`);

  const debugRes = await fetch(
    `${IG_API}/debug_token?input_token=${token}&access_token=${token}`,
  );
  const debug = await debugRes.json();
  const info = debug?.data;
  if (!info) {
    console.warn('⚠️  debug_token 응답 파싱 실패:', JSON.stringify(debug));
    return;
  }

  const scopes: string[] = info.scopes || info.granular_scopes?.flatMap((g: { scope: string }) => g.scope) || [];
  const expiresAt = info.expires_at ? new Date(info.expires_at * 1000).toISOString() : '영구';
  const dataAccessExpiresAt = info.data_access_expires_at
    ? new Date(info.data_access_expires_at * 1000).toISOString()
    : 'N/A';

  console.log(`   type=${info.type} app_id=${info.app_id} is_valid=${info.is_valid}`);
  console.log(`   expires_at=${expiresAt}`);
  console.log(`   data_access_expires_at=${dataAccessExpiresAt}`);
  console.log(`   scopes: ${scopes.join(', ') || '(없음)'}`);

  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    console.error(`❌ 누락된 scope: ${missing.join(', ')}`);
    console.error('   → Meta 앱 대시보드에서 권한 추가 후 토큰 재발급 필요');
    process.exit(1);
  }
  console.log(`✅ 필수 scope 모두 보유`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
