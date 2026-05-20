export interface MatchInsightSections {
  headline: string;
  recentForm: string;
  keyMatchup: string;
  watchPoints: string[];
  viewingInfo: string;
}

export interface MatchInsight {
  matchId: string;
  generatedAt: string;
  model: string;
  sections: MatchInsightSections;
}
