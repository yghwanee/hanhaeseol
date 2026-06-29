// 한해설 서비스워커 — PWA 설치 + 웹푸시 수신 + 빠른 실행(흰 번쩍 방지).
// 루트("/")는 stale-while-revalidate: 캐시본을 즉시 반환해 네트워크 대기 중
// 흰 화면(웹뷰 기본색)이 번쩍이는 걸 없애고, 백그라운드로 최신본을 받아 캐시 갱신.
// 그 외 페이지/데이터는 네트워크 우선(+오프라인 폴백)으로 stale 위험 없게 둔다.
const CACHE = "hhs-shell-v2";
const OFFLINE_URL = "/offline";
const ROOT_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 루트와 오프라인 페이지 미리 캐시(첫 실행 후부터 즉시 표시 가능).
      await cache.add(OFFLINE_URL).catch(() => {});
      await cache.add(ROOT_URL).catch(() => {});
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

  const url = new URL(req.url);
  const isRoot = url.pathname === "/";

  if (isRoot) {
    // stale-while-revalidate: 캐시본 즉시 반환(흰 번쩍 방지) + 백그라운드 최신화.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(ROOT_URL);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(ROOT_URL, res.clone());
            return res;
          })
          .catch(() => null);
        // 캐시 있으면 즉시(=흰 번쩍 없음). 없으면(첫 실행) 네트워크 대기.
        return cached || (await network) || (await caches.match(OFFLINE_URL));
      })(),
    );
    return;
  }

  // 그 외 페이지: 네트워크 우선 + 오프라인 폴백.
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
