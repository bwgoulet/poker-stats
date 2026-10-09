import { supabaseConfig } from '@/lib/backend/supabase';
import LoginForm from './login-form';
export default function LoginPage() {
  return <div className="mx-auto max-w-md card p-6 sm:p-8">
    <p className="text-sm font-bold text-carolina-dark">League management</p>
    <h1 className="mt-2 text-3xl font-black text-navy">Welcome back</h1>
    <p className="my-4 text-gray-600">Sign in with your league account to record games and manage results.</p>
    <LoginForm configured={!!supabaseConfig()} />
  </div>;
}
