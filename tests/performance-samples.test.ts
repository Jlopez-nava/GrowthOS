import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../lib/domain/types';
import {canShowSamples,makePerformanceSample,sampleBrand} from '../lib/domain/performance-samples';
import {localRange,funnelCounts,groupRows,rowsIn,total,ratio,campaignReview} from '../lib/domain/performance';
const profile={...emptyWorkspace().profile,name:'PromptPilot',website:'https://promptpilot.example'};
const range=localRange('America/Los_Angeles',7);
test('showcase is limited to the two fictional brands and cannot hide connected or saved real reports',()=>{
 assert.equal(sampleBrand(profile),'promptpilot');assert.equal(sampleBrand({...profile,name:'Example Services',website:'https://services.example'}),null);
 assert.equal(sampleBrand({...profile,website:'https://promptpilot.com'}),null);
 assert.equal(canShowSamples(profile,null),false);assert.equal(canShowSamples(profile,{configured:false,reports:{}}),true);assert.equal(canShowSamples(profile,{configured:true,reports:{}}),false);
 const sample=makePerformanceSample(profile,range)!;assert.equal(canShowSamples(profile,{configured:false,reports:{paid:sample.reports.paid}}),false);
});
test('both showcases supply full valid history, coherent funnels, distinct scenarios and actionable campaign contrasts',()=>{
 for(const p of [profile,{...profile,name:'Juniper & Co.',website:'https://juniperhome.example'}]){
 const sample=makePerformanceSample(p,range)!;for(const r of Object.values(sample.reports)){assert.equal(new Set(r.rows.map(row=>row.date)).size,56);assert(r.provider.includes('Fictional'));assert(r.account.name.includes('SAMPLE'));for(const row of r.rows){assert(row.date>=range.previousStart&&row.date<=range.end);for(const v of Object.values(row))if(typeof v==='number')assert(Number.isFinite(v)&&v>=0);}}
 for(const row of sample.reports.traffic.rows)assert(Number(row.engagedSessions)<=Number(row.sessions));
 assert.equal(funnelCounts(sample.journeys.rows,range)[0],1500);assert.equal(funnelCounts(sample.journeys.rows,range,true)[0],1200);const counts=funnelCounts(sample.journeys.rows,range);assert(counts.every((v,i)=>i===0||v<=counts[i-1]));assert(counts[4]>0);
 const labels=[...groupRows(rowsIn(sample.reports.paid,range),'id')].map(([id,rows])=>{const prior=rowsIn(sample.reports.paid,range,true).filter(r=>r.id===id),spend=total(rows,'spend')!,conversions=total(rows,'conversions')!;return campaignReview({spend,conversions,cpa:ratio(spend,conversions),previousCPA:ratio(total(prior,'spend'),total(prior,'conversions')),target:sample.config.campaigns[id].targetCPA,minSpend:200,verified:true,stale:false}).label;});assert(labels.includes('Consider scaling'));assert(labels.includes('Investigate'));
 assert.deepEqual(sample.reports.paid.rows,makePerformanceSample(p,range)!.reports.paid.rows);
 }
});
