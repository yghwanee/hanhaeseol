import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) {
    console.error(`❌ ${path} 파일이 없습니다.`);
    process.exit(1);
  }
  let raw = readFileSync(path, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const appId = env.IG_APP_ID;
  const appSecret = env.IG_APP_SECRET;
  const shortToken = env.IG_SHORT_TOKEN;

  console.log(`🔍 감지된 키: ${Object.keys(env).join(', ') || '(없음)'}`);

  if (!appId || !appSecret || !shortToken) {
    console.error('\n❌ .env.local에 IG_APP_ID, IG_APP_SECRET, IG_SHORT_TOKEN 세 값이 모두 필요합니다.');
    console.error(`   현재 상태: IG_APP_ID=${appId ? 'OK' : '없음'}, IG_APP_SECRET=${appSecret ? 'OK' : '없음'}, IG_SHORT_TOKEN=${shortToken ? 'OK' : '없음'}`);
    process.exit(1);
  }

  console.log('\n🔄 1/3 단기 토큰 → 장기 사용자 토큰 교환 중...');
  const exchangeUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
  const exchangeRes = await fetch(exchangeUrl);
  const exchangeData = await exchangeRes.json();
  if (!exchangeData.access_token) {
    console.error('❌ 장기 토큰 교환 실패:', JSON.stringify(exchangeData, null, 2));
    process.exit(1);
  }
  const longUserToken: string = exchangeData.access_token;
  console.log('✅ 장기 사용자 토큰 발급 완료 (60일 유효)');

  console.log('\n🔄 2/3 페이지 목록 및 페이지 액세스 토큰 조회 중...');
  const pagesUrl = `${GRAPH_API}/me/accounts?access_token=${longUserToken}`;
  const pagesRes = await fetch(pagesUrl);
  const pagesData = await pagesRes.json();
  if (!pagesData.data || pagesData.data.length === 0) {
    console.error('❌ 페이지를 찾을 수 없습니다. 페이스북 페이지가 연결됐는지 확인하세요.');
    console.error(JSON.stringify(pagesData, null, 2));
    process.exit(1);
  }

  console.log(`✅ 페이지 ${pagesData.data.length}개 발견`);

  console.log('\n🔄 3/3 각 페이지의 Instagram Business 계정 확인 중...');
  for (const page of pagesData.data) {
    console.log(`\n──────────────────────────────────────────────`);
    console.log(`📘 페이지명: ${page.name}`);
    console.log(`📘 페이지 ID: ${page.id}`);

    const igUrl = `${GRAPH_API}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`;
    const igRes = await fetch(igUrl);
    const igData = await igRes.json();

    if (igData.instagram_business_account?.id) {
      const igId = igData.instagram_business_account.id;
      console.log(`📸 Instagram Business Account ID: ${igId}`);
      console.log(`\n🎯 GitHub Secrets에 등록할 값:`);
      console.log(`   IG_PAGE_ACCESS_TOKEN = ${page.access_token}`);
      console.log(`   IG_BUSINESS_ACCOUNT_ID = ${igId}`);
    } else {
      console.log(`⚠️  이 페이지에 연결된 Instagram Business 계정이 없습니다.`);
    }
  }

  console.log(`\n──────────────────────────────────────────────`);
  console.log('\n✅ 완료. 위에 출력된 값을 GitHub Secrets에 등록하세요.');
  console.log('   (페이지 액세스 토큰은 장기 사용자 토큰에서 파생돼 만료되지 않습니다)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
