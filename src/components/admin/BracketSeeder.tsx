'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, LayoutGrid, Plus, Shuffle, Trophy } from 'lucide-react';
import { BracketFormat, BracketMatch, SeededTeam, roundRobinRounds, seedFirstRound } from '@/lib/brackets/seeding';

type Season = { id: string; label: string; teams: Array<{ id: string; name: string }> };

function TeamSlot({ team, fallback = 'TBD' }: { team?: SeededTeam; fallback?: string }) {
  return <div className={`flex h-10 items-center gap-2 border-b border-slate-200 px-3 last:border-0 ${team ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}><span className="w-6 text-xs font-bold text-slate-400">{team ? team.seed : '—'}</span><span className="truncate text-sm font-semibold">{team?.name ?? fallback}</span></div>;
}

function MatchCard({ match }: { match: BracketMatch }) {
  return <div className="w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><TeamSlot team={match.teamA} /><TeamSlot team={match.teamB} /></div>;
}

function DoubleElimination({ teams }: { teams: SeededTeam[] }) {
  const first = seedFirstRound(teams);
  const nextCount = Math.max(1, Math.ceil(first.length / 2));
  return <div className="min-w-max space-y-10 p-6">
    <section><div className="mb-4 flex items-center gap-2"><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">WINNERS</span><span className="text-xs text-slate-400">Double elimination</span></div><div className="flex gap-14">
      <div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Round 1</p><div className="grid gap-5">{first.map(match => <MatchCard key={match.id} match={match} />)}</div></div>
      <div className="pt-12"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Semifinals</p><div className="grid gap-24">{Array.from({length: nextCount},(_,i)=><MatchCard key={i} match={{id:`w2-${i}`,round:2,label:'',}} />)}</div></div>
      <div className="pt-32"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Final</p><MatchCard match={{id:'final',round:3,label:''}} /></div>
    </div></section>
    <section><div className="mb-4"><span className="rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">ELIMINATION</span></div><div className="flex gap-14">{['Lower round 1','Lower semifinal','Lower final'].map((label,i)=><div key={label}><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><div className="grid gap-5">{Array.from({length:Math.max(1,Math.ceil(first.length / (i+2)))},(_,j)=><MatchCard key={j} match={{id:`l-${i}-${j}`,round:i+1,label:''}} />)}</div></div>)}</div></section>
  </div>;
}

function RoundRobin({ teams }: { teams: SeededTeam[] }) {
  return <div className="flex min-w-max gap-6 p-6">{roundRobinRounds(teams).map((matches,index)=><section className="w-64" key={index}><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Round {index+1}</p><div className="grid gap-4">{matches.map(match=><div key={match.id}><p className="mb-1 text-[11px] font-semibold text-slate-400">{match.label}</p><MatchCard match={match}/></div>)}</div></section>)}</div>;
}

export function BracketSeeder({ seasons }: { seasons: Season[] }) {
  const [seasonId,setSeasonId]=useState(seasons[0]?.id ?? '');
  const [format,setFormat]=useState<BracketFormat>('double-elimination');
  const current=seasons.find(s=>s.id===seasonId) ?? seasons[0];
  const initial=useMemo(()=>current?.teams.map((team,index)=>({...team,seed:index+1})) ?? [],[current]);
  const [seeds,setSeeds]=useState(initial); const [bracket,setBracket]=useState<SeededTeam[]|null>(null);
  const chooseSeason=(id:string)=>{setSeasonId(id);const next=seasons.find(s=>s.id===id);setSeeds(next?.teams.map((t,i)=>({...t,seed:i+1}))??[]);setBracket(null)};
  const move=(index:number,direction:number)=>{const target=index+direction;if(target<0||target>=seeds.length)return;const next=[...seeds];[next[index],next[target]]=[next[target],next[index]];setSeeds(next.map((t,i)=>({...t,seed:i+1})));setBracket(null)};
  const shuffle=()=>{const next=[...seeds];for(let i=next.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[next[i],next[j]]=[next[j],next[i]]}setSeeds(next.map((t,i)=>({...t,seed:i+1})));setBracket(null)};
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm font-bold text-red-600">ADMIN / TOURNAMENTS &amp; SEASONS</p><h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Bracket seeder</h1><p className="mt-2 text-slate-500">Seed the field, choose a format, and publish a bracket in a few clicks.</p></div><button className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold shadow-sm"><Plus size={16}/> New tournament</button></header>
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="card h-fit overflow-hidden"><div className="border-b p-5"><h2 className="font-black">Bracket setup</h2><p className="text-sm text-slate-500">Select a season and competition type.</p></div><div className="grid gap-5 p-5">
        <label className="grid gap-2 text-sm font-bold">Tournament / season<select className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium" value={seasonId} onChange={e=>chooseSeason(e.target.value)}>{seasons.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label>
        <fieldset><legend className="mb-2 text-sm font-bold">Bracket format</legend><div className="grid grid-cols-2 gap-2">{([['double-elimination','Double elimination'],['round-robin','Round robin']] as const).map(([value,label])=><button key={value} onClick={()=>{setFormat(value);setBracket(null)}} className={`rounded-xl border p-3 text-left text-sm font-bold transition ${format===value?'border-red-600 bg-red-50 text-red-700':'border-slate-200 hover:border-slate-300'}`}><LayoutGrid className="mb-2" size={18}/>{label}</button>)}</div></fieldset>
        <button disabled={!seeds.length} onClick={()=>setBracket(seeds)} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-40"><Trophy size={18}/>{bracket?'Recreate bracket':'Create bracket'}</button>
      </div></aside>
      <section className="card overflow-hidden"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-black">Seed order</h2><p className="text-sm text-slate-500">{seeds.length} existing participants</p></div><button onClick={shuffle} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold hover:bg-slate-50"><Shuffle size={15}/> Shuffle</button></div><div className="divide-y">{seeds.map((team,index)=><div className="flex items-center gap-3 px-4 py-3" key={team.id}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-black">{index+1}</span><span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span><div className="flex"><button aria-label={`Move ${team.name} up`} className="p-2 text-slate-400 hover:text-slate-900" onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button aria-label={`Move ${team.name} down`} className="p-2 text-slate-400 hover:text-slate-900" onClick={()=>move(index,1)}><ArrowDown size={16}/></button></div></div>)}</div></section>
    </div>
    {bracket&&<section className="card overflow-hidden"><div className="flex items-center justify-between border-b p-5"><div><div className="flex items-center gap-2"><Eye size={18} className="text-red-600"/><h2 className="font-black">Bracket preview</h2></div><p className="mt-1 text-sm text-slate-500">{current?.label} · {format==='double-elimination'?'Double elimination':'Round robin'}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">CREATED</span></div><div className="overflow-x-auto bg-slate-50/60">{format==='double-elimination'?<DoubleElimination teams={bracket}/>:<RoundRobin teams={bracket}/>}</div></section>}
  </div>;
}
