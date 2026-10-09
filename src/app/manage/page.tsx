import { ManagementPortal } from '@/components/manage/ManagementPortal';
import { getPortalData } from '@/lib/backend/repository';
import { notFound } from 'next/navigation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ leagueId?: string }> }) {
  const { leagueId } = await searchParams;
  if (leagueId && !z.uuid().safeParse(leagueId).success) notFound();
  const data = await getPortalData(leagueId);
  if (leagueId && data.selectedLeagueId !== leagueId) notFound();
  return <ManagementPortal initialData={data} />;
}
