import { getCurrentUser, readAll } from './repository';
import { serverSupabase } from './supabase';
export interface LinkRequest {
  id: string; league_id: string; league_name: string; player_id: string; player_name: string;
  user_id: string; discord_id: string | null; account_name: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; created_at: string;
}
export async function getAccountLinkRequests() {
  const user = await getCurrentUser();
  if (!user) return { requests: [] as LinkRequest[], choice: null as string | null };
  const client = await serverSupabase();
  const [requests, profile] = await Promise.all([
    readAll<LinkRequest>(() => client.rpc('list_player_link_requests')),
    client.from('users').select('onboarding_choice').eq('id', user.id).single(),
  ]);
  if (profile.error) throw new Error('Unable to load account setup. Apply the link verification migration.');
  return { requests, choice: profile.data.onboarding_choice as string | null };
}
