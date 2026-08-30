export const playerSortKeys = ['player', 'totalProfit', 'avgProfit', 'medianProfit', 'roi', 'volatility', 'nightsPlayed', 'wins', 'winRate'] as const;
export type PlayerSortKey = (typeof playerSortKeys)[number];

export interface RankablePlayer {
  player: { displayName: string };
  totalProfit: number;
  avgProfit: number;
  medianProfit: number;
  roi: number;
  volatility: number;
  nightsPlayed: number;
  wins: number;
  winRate: number;
}

/** Returns a new array ranked greatest-to-lowest for the selected column. */
export function rankPlayers<T extends RankablePlayer>(rows: T[], sortKey: PlayerSortKey): T[] {
  return rows.slice().sort((a, b) => {
    if (sortKey === 'player') return b.player.displayName.localeCompare(a.player.displayName);
    return b[sortKey] - a[sortKey] || a.player.displayName.localeCompare(b.player.displayName);
  });
}
