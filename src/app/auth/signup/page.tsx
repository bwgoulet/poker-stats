import { DiscordSignIn } from '@/components/account/DiscordSignIn';
import { accountReturnTo } from '@/lib/backend/account';
import { supabaseConfig } from '@/lib/backend/supabase';
import SignupForm from './signup-form';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <div className="card mx-auto max-w-md p-6 sm:p-8">
    <p className="text-sm font-bold text-carolina-dark">Your seat at the table</p>
    <h1 className="mt-2 text-3xl font-black text-navy">Create your account</h1>
    <p className="my-4 text-gray-600">Join as a player, then connect your account to your existing player page in each league.</p>
    <div className="mb-5"><DiscordSignIn configured={!!supabaseConfig()} next={accountReturnTo(next)} /></div>
    <SignupForm configured={!!supabaseConfig()} next={accountReturnTo(next)} />
  </div>;
}
