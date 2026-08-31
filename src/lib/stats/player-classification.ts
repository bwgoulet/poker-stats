import { PlayerResult, PokerNight } from '@/types/poker';

export const MIN_CLASSIFICATION_NIGHTS = 5;
export const ESTABLISHED_CLASSIFICATION_NIGHTS = 15;
export const LOW_TYPE_PERCENTILE = 25;
export const HIGH_TYPE_PERCENTILE = 75;

export type PlayerType = 'NIT' | 'Steady' | 'Neutral' | 'Gambler' | 'Action Player' | 'Maniac';
export type ClassificationConfidence = 'insufficient' | 'provisional' | 'established';
export type PlayerClassificationLabel = PlayerType | 'Insufficient history';

export const PLAYER_TYPE_DESCRIPTIONS: Record<PlayerClassificationLabel, string> = {
  Maniac: 'High buy-in intensity and high outcome swings: both rank in the top quarter of the eligible field.',
  'Action Player': 'High buy-in intensity, but not high outcome swings. This player frequently puts multiple buy-ins into play without the field’s most extreme results.',
  Gambler: 'High outcome swings, but not high buy-in intensity. This player has unusually large results without consistently putting the most buy-ins into play.',
  Neutral: 'Neither buy-in intensity nor outcome swings are unusually high or low relative to the eligible field.',
  Steady: 'Low outcome swings without the low buy-in intensity required for a NIT. This player’s results are unusually consistent.',
  NIT: 'Low buy-in intensity and low outcome swings: both rank in the bottom quarter of the eligible field.',
  'Insufficient history': `Fewer than ${MIN_CLASSIFICATION_NIGHTS} comparable nights are available, so no player type is assigned yet.`,
};

export interface PlayerClassification {
  type: PlayerClassificationLabel;
  confidence: ClassificationConfidence;
  qualifyingNights: number;
  exposurePercentile: number | null;
  swingPercentile: number | null;
  medianBuyInUnits: number | null;
  multiBuyInRate: number | null;
  outcomeSwing: number | null;
}

interface ClassifiablePlayer {
  player: { id: string };
  results: PlayerResult[];
}

interface Measurements {
  id: string;
  qualifyingNights: number;
  medianBuyInUnits: number;
  upperBuyInUnits: number;
  multiBuyInRate: number;
  outcomeSwing: number;
}

const percentile = (sorted: number[], fraction: number) => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const median = (values: number[]) => percentile(values.slice().sort((a, b) => a - b), 0.5);

/** Percentile rank from 0 to 100, assigning tied values their average rank. */
function percentileRanks(values: Map<string, number>) {
  const ordered = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const ranks = new Map<string, number>();
  if (ordered.length === 1) {
    ranks.set(ordered[0][0], 50);
    return ranks;
  }

  for (let start = 0; start < ordered.length;) {
    let end = start;
    while (end + 1 < ordered.length && ordered[end + 1][1] === ordered[start][1]) end += 1;
    const rank = (((start + end) / 2) / (ordered.length - 1)) * 100;
    for (let index = start; index <= end; index += 1) ranks.set(ordered[index][0], rank);
    start = end + 1;
  }
  return ranks;
}

function nominalBuyIn(night: PokerNight) {
  if (night.nightType === 'one-off') return null;
  const amount = Number(night.nightType);
  return amount > 0 ? amount : null;
}

function measurePlayer(player: ClassifiablePlayer, nights: Map<string, PokerNight>): Measurements {
  const normalized = player.results.flatMap((result) => {
    const night = nights.get(result.nightId);
    const buyIn = night && nominalBuyIn(night);
    return buyIn ? [{ buyInUnits: result.buyIn / buyIn, profitUnits: result.profit / buyIn }] : [];
  });
  const buyIns = normalized.map((result) => result.buyInUnits).sort((a, b) => a - b);
  const profits = normalized.map((result) => result.profitUnits);
  const medianProfit = median(profits);
  const mad = median(profits.map((profit) => Math.abs(profit - medianProfit)));

  return {
    id: player.player.id,
    qualifyingNights: normalized.length,
    medianBuyInUnits: median(buyIns),
    upperBuyInUnits: percentile(buyIns, 0.75),
    multiBuyInRate: normalized.length
      ? normalized.filter((result) => result.buyInUnits > 1.05).length / normalized.length
      : 0,
    outcomeSwing: 1.4826 * mad,
  };
}

function classify(exposure: 'low' | 'middle' | 'high', swing: 'low' | 'middle' | 'high'): PlayerType {
  if (exposure === 'high' && swing === 'high') return 'Maniac';
  if (exposure === 'high') return 'Action Player';
  if (swing === 'high') return 'Gambler';
  if (exposure === 'low' && swing === 'low') return 'NIT';
  if (swing === 'low') return 'Steady';
  return 'Neutral';
}

/** Classifies players by their exposure and swing percentiles within the eligible field. */
export function classifyPlayers(players: ClassifiablePlayer[], nights: PokerNight[]) {
  const nightMap = new Map(nights.map((night) => [night.id, night]));
  const measurements = players.map((player) => measurePlayer(player, nightMap));
  const eligible = measurements.filter((player) => player.qualifyingNights >= MIN_CLASSIFICATION_NIGHTS);

  const medianRanks = percentileRanks(new Map(eligible.map((player) => [player.id, player.medianBuyInUnits])));
  const multiRanks = percentileRanks(new Map(eligible.map((player) => [player.id, player.multiBuyInRate])));
  const upperRanks = percentileRanks(new Map(eligible.map((player) => [player.id, player.upperBuyInUnits])));
  const swingRanks = percentileRanks(new Map(eligible.map((player) => [player.id, player.outcomeSwing])));
  const exposureScores = new Map(eligible.map((player) => [player.id,
    (medianRanks.get(player.id)! * 0.5) + (multiRanks.get(player.id)! * 0.3) + (upperRanks.get(player.id)! * 0.2),
  ]));
  const exposureRanks = percentileRanks(exposureScores);

  return new Map(measurements.map((player): [string, PlayerClassification] => {
    if (player.qualifyingNights < MIN_CLASSIFICATION_NIGHTS) {
      return [player.id, {
        type: 'Insufficient history', confidence: 'insufficient',
        qualifyingNights: player.qualifyingNights, exposurePercentile: null, swingPercentile: null,
        medianBuyInUnits: player.qualifyingNights ? player.medianBuyInUnits : null,
        multiBuyInRate: player.qualifyingNights ? player.multiBuyInRate : null,
        outcomeSwing: player.qualifyingNights ? player.outcomeSwing : null,
      }];
    }

    const exposurePercentile = exposureRanks.get(player.id)!;
    const swingPercentile = swingRanks.get(player.id)!;
    const exposure = exposurePercentile >= HIGH_TYPE_PERCENTILE
      ? 'high'
      : exposurePercentile <= LOW_TYPE_PERCENTILE ? 'low' : 'middle';
    const swing = swingPercentile >= HIGH_TYPE_PERCENTILE
      ? 'high'
      : swingPercentile <= LOW_TYPE_PERCENTILE ? 'low' : 'middle';

    return [player.id, {
      type: classify(exposure, swing),
      confidence: player.qualifyingNights >= ESTABLISHED_CLASSIFICATION_NIGHTS ? 'established' : 'provisional',
      qualifyingNights: player.qualifyingNights,
      exposurePercentile,
      swingPercentile,
      medianBuyInUnits: player.medianBuyInUnits,
      multiBuyInRate: player.multiBuyInRate,
      outcomeSwing: player.outcomeSwing,
    }];
  }));
}
