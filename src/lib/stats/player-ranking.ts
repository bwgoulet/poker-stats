export const playerSortKeys = ['player', 'type', 'buyInIntensity', 'outcomeSwing', 'totalProfit', 'avgProfit', 'roi', 'nightsPlayed', 'wins', 'winRate'] as const;
export type PlayerSortKey = (typeof playerSortKeys)[number];

export interface RankablePlayer {
  player: { displayName: string };
  classification?: { type: string; averageBuyInUnits?: number | null; outcomeSwing?: number | null };
  totalProfit: number;
  avgProfit: number;
  roi: number;
  nightsPlayed: number;
  wins: number;
  winRate: number;
}

/** Returns a new array ranked greatest-to-lowest for the selected column. */
export function rankPlayers<T extends RankablePlayer>(rows: T[], sortKey: PlayerSortKey): T[] {
  return rows.slice().sort((a, b) => {
    if (sortKey === 'player') return b.player.displayName.localeCompare(a.player.displayName);
    if (sortKey === 'type') {
      const typeOrder: Record<string, number> = {
        Maniac: 9,
        'Action Player': 8,
        Whale: 7,
        'Chemical X': 6,
        Gambler: 5,
        Neutral: 4,
        Steady: 3,
        'One-Bullet': 2,
        NIT: 1,
        'Insufficient history': 0,
      };
      return (typeOrder[b.classification?.type ?? ''] ?? -1) - (typeOrder[a.classification?.type ?? ''] ?? -1)
        || a.player.displayName.localeCompare(b.player.displayName);
    }
    if (sortKey === 'buyInIntensity' || sortKey === 'outcomeSwing') {
      const classificationKey = sortKey === 'buyInIntensity' ? 'averageBuyInUnits' : 'outcomeSwing';
      const aValue = a.classification?.[classificationKey];
      const bValue = b.classification?.[classificationKey];
      if (aValue == null && bValue == null) return a.player.displayName.localeCompare(b.player.displayName);
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return bValue - aValue || a.player.displayName.localeCompare(b.player.displayName);
    }
    return b[sortKey] - a[sortKey] || a.player.displayName.localeCompare(b.player.displayName);
  });
}
