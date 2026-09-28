'use client';
import {Plus,X,Search} from 'lucide-react';
import type {Profile} from '@/lib/domain/types';
export default function CompetitorOnboarding({profile,onChange,live}:{profile:Profile;onChange:(p:Profile)=>void;live:boolean}){
 const entries=profile.competitorEntries??[];
 return <fieldset className="competitor-onboarding span-2"><legend>Who do you compete with?</legend><p>Add the businesses you already know. You can review suggested matches after saving your brand.</p>
  {entries.map((entry,i)=><div className="competitor-input-row" key={i}><label>Competitor name<input required maxLength={100} value={entry.name} onChange={e=>onChange({...profile,competitorEntries:entries.map((r,n)=>n===i?{...r,name:e.target.value}:r)})} placeholder="Business name"/></label><label>Website<input required maxLength={2000} value={entry.website} onChange={e=>onChange({...profile,competitorEntries:entries.map((r,n)=>n===i?{...r,website:e.target.value}:r)})} placeholder="https://competitor.com"/></label><button type="button" className="icon-button" aria-label={'Remove competitor '+(i+1)} onClick={()=>onChange({...profile,competitorEntries:entries.filter((_,n)=>n!==i)})}><X size={18}/></button></div>)}
  <button type="button" className="secondary" disabled={entries.length>=30} onClick={()=>onChange({...profile,competitorEntries:[...entries,{name:'',website:''}]})}><Plus size={16}/>Add a competitor</button>
  {live?<label className="competitor-auto"><input type="checkbox" checked={profile.discoverCompetitors??true} onChange={e=>onChange({...profile,discoverCompetitors:e.target.checked})}/><span><strong><Search size={16}/> Find other competitors after setup</strong><small>Search the public web using your brand name, website, services, audience, and location. Suggestions need your approval. Uses your company’s OpenAI API allowance.</small></span></label>:<p className="subtle">Manual competitors are saved here. Automated web discovery is available in a connected company workspace.</p>}
 </fieldset>;
}
