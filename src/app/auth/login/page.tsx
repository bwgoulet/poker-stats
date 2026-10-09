import { supabaseConfig } from '@/lib/backend/supabase';
import LoginForm from './login-form';
import { accountReturnTo } from '@/lib/backend/account';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmation?: string }> }) {
  const params = await searchParams;
  return <div className="mx-auto max-w-md card p-6 sm:p-8">
    <p className="text-sm font-bold text-carolina-dark">Your poker account</p>
    <h1 className="mt-2 text-3xl font-black text-navy">Welcome back</h1>
    <p className="my-4 text-gray-600">Sign in to link your player pages. Admins can also record games and manage results.</p>
    {params.confirmation === 'failed' && <p role="alert" className="mb-4 text-sm text-rose-700">The confirmation link could not be completed. If your email is already confirmed, sign in below. Otherwise, request a new signup confirmation.</p>}
    <LoginForm configured={!!supabaseConfig()} next={accountReturnTo(params.next)} />
  </div>;
}
