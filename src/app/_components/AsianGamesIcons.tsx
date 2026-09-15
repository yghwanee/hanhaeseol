/**
 * 아시안게임 배너 3D 아이콘(성화·메달). 2026-09-15 시안 B·C 에서 확정.
 *
 * 후원 배너의 선물 상자처럼 **광택 있는 입체 일러스트**다. 이미지 파일이 아니라 SVG 라
 * 요청이 안 늘고(Hobby FOT 한도) 어떤 크기로 줄여도 선명하다.
 *
 * 🔴 그라데이션 색은 일러스트 재질(금속·불꽃)이라 디자인 토큰 밖의 hex 를 쓴다.
 * UI 색(글자·면·선)은 여기 넣지 말 것 — 그건 토큰이다.
 *
 * `id` 는 한 화면에 같은 아이콘이 둘 이상 뜰 때 그라데이션 id 가 겹치지 않게 하는 접두사다
 * (SVG `url(#…)` 은 문서 전체에서 첫 번째 정의를 집는다).
 */

export function TorchIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className}>
      <defs>
        <radialGradient id={`${id}-flame`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#FFB3A8" />
          <stop offset="0.45" stopColor="#F0444C" />
          <stop offset="1" stopColor="#9E1320" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="0.45" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#FFF3C2" />
          <stop offset="0.5" stopColor="#F8C63E" />
          <stop offset="1" stopColor="#C98A10" />
        </radialGradient>
        <linearGradient id={`${id}-cup`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E4E8EF" />
          <stop offset="0.55" stopColor="#9AA1AE" />
          <stop offset="1" stopColor="#555B67" />
        </linearGradient>
        <linearGradient id={`${id}-grip`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8E95A2" />
          <stop offset="0.5" stopColor="#5A606C" />
          <stop offset="1" stopColor="#33373F" />
        </linearGradient>
        <filter id={`${id}-sh`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#${id}-sh)`}>
        <path d="M50 66 L70 66 L64 114 Q60 118 56 114 Z" fill={`url(#${id}-grip)`} />
        <rect x="38" y="54" width="44" height="16" rx="6" fill={`url(#${id}-cup)`} />
        <path
          d="M60 4 C78 22 94 36 86 52 C82 60 38 60 34 52 C26 38 44 30 50 14 C54 26 58 28 60 4 Z"
          fill={`url(#${id}-flame)`}
        />
        <path d="M60 22 C71 34 77 43 71 52 C67 58 53 58 49 52 C45 45 53 38 60 22 Z" fill={`url(#${id}-core)`} />
        <ellipse cx="47" cy="34" rx="7" ry="4" fill="#ffffff" opacity="0.45" transform="rotate(-50 47 34)" />
        <rect x="42" y="56" width="16" height="4" rx="2" fill="#ffffff" opacity="0.55" />
      </g>
    </svg>
  );
}

const MEDAL_TONES = {
  gold: { stops: ["#FFF6CF", "#F8CC4A", "#D89A18", "#8A5A08"], ring: "#FFE7A3", mark: "#8A5A08", shine: 0.5, n: "1" },
  silver: { stops: ["#FFFFFF", "#DCE1E8", "#9DA5B1", "#5A616C"], ring: "#FFFFFF", mark: "#4A515C", shine: 0.6, n: "2" },
  bronze: { stops: ["#FFE1C4", "#DE9357", "#A55C25", "#633311"], ring: "#FFD2AE", mark: "#633311", shine: 0.45, n: "3" },
} as const;

export function MedalIcon({
  id,
  tone,
  className,
}: {
  id: string;
  tone: keyof typeof MEDAL_TONES;
  className?: string;
}) {
  const t = MEDAL_TONES[tone];
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className}>
      <defs>
        <radialGradient id={`${id}-face`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor={t.stops[0]} />
          <stop offset="0.38" stopColor={t.stops[1]} />
          <stop offset="0.76" stopColor={t.stops[2]} />
          <stop offset="1" stopColor={t.stops[3]} />
        </radialGradient>
        <linearGradient id={`${id}-rib`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FA6FF" />
          <stop offset="1" stopColor="#1C3FB8" />
        </linearGradient>
        <filter id={`${id}-sh`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#${id}-sh)`}>
        <polygon points="34,6 56,6 66,56 46,60" fill={`url(#${id}-rib)`} />
        <polygon points="86,6 64,6 54,56 74,60" fill={`url(#${id}-rib)`} opacity="0.8" />
        <circle cx="60" cy="80" r="34" fill={`url(#${id}-face)`} />
        <circle cx="60" cy="80" r="24" fill="none" stroke={t.ring} strokeOpacity="0.7" strokeWidth="2" />
        <text
          x="60"
          y="91"
          textAnchor="middle"
          fontSize="30"
          fontWeight="800"
          fill={t.mark}
          fillOpacity="0.5"
          fontFamily="system-ui, sans-serif"
        >
          {t.n}
        </text>
        <ellipse cx="47" cy="63" rx="12" ry="6" fill="#ffffff" opacity={t.shine} transform="rotate(-32 47 63)" />
      </g>
    </svg>
  );
}
