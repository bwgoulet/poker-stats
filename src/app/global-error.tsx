'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui', padding: '3rem', color: '#13294b' }}>
    <h1>League records are unavailable</h1>
    <p>Retry, or ask your administrator to check the database connection and setup.</p>
    <button onClick={reset}>Retry</button>
  </body></html>;
}
