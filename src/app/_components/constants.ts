export const SPORTS = ["전체", "축구", "야구", "농구", "배구"] as const;

export const PLATFORM_LIST = [
  { key: "전체", label: "전체" },
  { key: "쿠팡플레이", label: "쿠팡플레이" },
  { key: "티빙", label: "티빙" },
  { key: "SPOTV NOW", label: "SPOTV NOW" },
  { key: "SPOTV", label: "SPOTV" },
  { key: "SPOTV2", label: "SPOTV2" },
  { key: "Apple TV+", label: "Apple TV+" },
  { key: "tvN SPORTS", label: "tvN" },
  { key: "KBS N SPORTS", label: "KBS N" },
  { key: "MBC SPORTS+", label: "MBC SPORTS" },
  { key: "SBS Sports", label: "SBS SPORTS" },
] as const;

export const PLATFORM_ICON_MAP: Record<string, string> = {
  "쿠팡플레이": "/platforms/coupangplay.png",
  "티빙": "/platforms/tving.png",
  "Apple TV+": "/platforms/appletv.png",
  "SPOTV NOW": "/platforms/spotvnow.png",
  "SPOTV": "/platforms/spotv.png",
  "SPOTV2": "/platforms/spotv.png",
  "tvN SPORTS": "/platforms/tvn.png",
  "KBS N SPORTS": "/platforms/kbs.jpg",
  "MBC SPORTS+": "/platforms/mbc.png",
  "SBS Sports": "/platforms/sbs.png",
};
