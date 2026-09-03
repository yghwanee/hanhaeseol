// 한해설 서비스워커 — PWA 설치 + 웹푸시 수신 + 오프라인 폴백.
//
// 페이지 HTML은 캐시하지 않는다(루트 "/" 포함). 이전 v2는 루트를
// stale-while-revalidate 로 캐시해 흰 번쩍을 줄이려 했지만, HTML은 빌드마다
// 바뀌는 /_next/static/<buildId>/ 에셋을 참조하므로 캐시본을 그대로 내놓으면
// 배포 직후 첫 로드에서 (a) 옛 배너·옛 편성표가 보이고 (b) 옛 청크가 404 나
// CSS·JS 없이 렌더된다(인트로가 화면을 못 덮고 배너 이미지가 전면 확대).
// 홈은 매시 크롤로 리빌드되므로 HTML 캐시는 항상 stale 이 된다. 캐시는
// 오프라인 폴백 용도로만 쓴다.
const CACHE = "hhs-shell-v3";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(OFFLINE_URL).catch(() => {});
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode !== "navigate") return;

  // 모든 페이지: 네트워크 우선 + 오프라인일 때만 폴백.
  // HTML 캐시본을 내놓지 않으므로 배포 직후에도 항상 최신 배너·편성표를 본다.
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});

// 웹푸시 수신 (#1 경기 알림). payload: { title, body, url, tag }
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    /* 비JSON 페이로드 무시 */
  }
  const title = payload.title || "한해설";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/favicon-192x192.png",
      badge: "/favicon-192x192.png",
      data: { url: payload.url || "/" },
      tag: payload.tag,
      // 🔴 같은 tag 는 규격상 **재알림 없이** 기존 알림을 교체한다. 한 경기의 킥오프·
      // 득점·종료가 전부 같은 tag 라, 이게 없으면 첫 알림만 소리가 나고 그 뒤 득점은
      // 알림창을 직접 열어야 보인다. 득점 알림이 이 기능의 핵심이라 무음이면 안 된다.
      // (renotify 는 tag 가 있어야만 허용된다)
      renotify: Boolean(payload.tag),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
