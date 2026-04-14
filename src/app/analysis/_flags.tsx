export const LEAGUE_FLAG: Record<string, string> = {
  "프리미어리그": "gb",
  "EFL 챔피언십": "gb",
  "라리가": "es",
  "세리에A": "it",
  "분데스리가": "de",
  "리그1": "fr",
  "리그 1": "fr",
  "챔피언스리그": "eu",
  "유로파리그": "eu",
  "컨퍼런스리그": "eu",
  "K리그": "kr",
  "K리그1": "kr",
  "K리그2": "kr",
  "KBO": "kr",
  "WKBL": "kr",
  "KBL": "kr",
  "NBA": "us",
  "MLB": "us",
  "MLS": "us",
  "일본프로농구": "jp",
  "NPB": "jp",
};

export function FlagIcon({ code }: { code: string }) {
  const src = `https://flagcdn.com/16x12/${code.toLowerCase()}.png`;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={code}
      width={16}
      height={12}
      className="inline-block"
    />
  );
}
