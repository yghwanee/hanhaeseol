export interface AnalysisArticle {
  id: string;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamEn: string;
  awayTeamEn: string;
  sourceUrl: string;
  prediction: string;
  content: string;
  crawledAt: string;
}

export interface AnalysisData {
  lastUpdated: string;
  articles: AnalysisArticle[];
}
