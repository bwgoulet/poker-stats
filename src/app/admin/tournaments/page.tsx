import { BracketSeeder } from '@/components/admin/BracketSeeder';
import { getPokerData } from '@/lib/data/poker-repository';

function seasonLabel(id: string) {
  return id.split('-').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

export default function TournamentsAdminPage() {
  const data = getPokerData();
  const seasons = [...new Set(data.nights.map(night => night.seasonId))].sort().reverse().map(id => {
    const nightIds = new Set(data.nights.filter(night => night.seasonId === id).map(night => night.id));
    const playerIds = new Set(data.results.filter(result => nightIds.has(result.nightId)).map(result => result.playerId));
    return { id, label: seasonLabel(id), teams: data.players.filter(player => playerIds.has(player.id)).map(player => ({ id: player.id, name: player.displayName })) };
  });
  return <BracketSeeder seasons={seasons} />;
}
