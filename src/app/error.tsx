'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="card p-8" role="alert">
    <h1 className="text-2xl font-black text-navy">League records are unavailable</h1>
    <p className="my-4 text-gray-600">Please retry. If the problem continues, ask your administrator to check the database connection and setup.</p>
    <button onClick={reset} className="rounded-lg bg-navy px-5 py-3 font-bold text-white">Retry</button>
  </div>;
}
