import { cache } from 'react';
import { getActivePokerData } from '@/lib/backend/repository';

export const getPokerData = cache(async () => getActivePokerData());

export async function getRepository() {
  const data = await getPokerData();
  return {
    getPlayers: () => data.players,
    getNights: () => data.nights,
    getResults: () => data.results,
    getIssues: () => data.issues,
  };
}
