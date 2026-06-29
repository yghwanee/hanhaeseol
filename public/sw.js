// 한해설 서비스워커 — PWA 설치 + 웹푸시 수신.
// 캐싱은 최소화: 편성표/데이터가 자주 바뀌므로 stale 방지를 위해 HTML·데이터는 항상
// 네트워크 우선으로 두고, 오프라인일 때만 캐시된 오프라인 페이지로 폴백한다.
const CACHE = "hhs-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
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

// 페이지 이동만 가로채 네트워크 우선 + 오프라인 폴백. 그 외(데이터·정적자원)는
// 브라우저 기본 동작(HTTP 캐시)에 맡겨 stale 위험을 만들지 않는다.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
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
