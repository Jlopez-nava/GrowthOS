'use client';
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="standalone"><h1>Something interrupted your workspace.</h1><p>Your saved data has not been cleared.</p><button onClick={reset}>Try again</button></main>; }
