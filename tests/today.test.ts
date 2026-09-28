import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,dayOffset} from '../lib/domain/types';
import {makePerformanceSample} from '../lib/domain/performance-samples';
import {localRange} from '../lib/domain/performance';
import {reportHealth,todayPriorities,todayFollowUps} from '../lib/domain/today';
import {actionDatasets,createAction,recordChange,checkResults} from '../lib/domain/actions';
function fixture(){const state=emptyWorkspace();state.profile={...state.profile,name:'PromptPilot',website:'https://promptpilot.example'};const range=localRange(state.profile.timezone,7),sample=makePerformanceSample(state.profile,range)!;state.performance=sample.config;return {state,range,...sample};}
test('Today uses the same campaign assessments as Performance with concrete campaign destinations',()=>{
 const {state,range,reports,config}=fixture();const priorities=todayPriorities(state,reports,range,config);
 assert(priorities.some(p=>p.title.includes('above its cost target')));assert(priorities.some(p=>p.title.includes('room to grow')));
 assert(priorities.every(p=>p.observed&&p.why&&p.next&&p.source));assert(priorities.filter(p=>p.focus.section==='paid').every(p=>p.focus.campaignId));
 assert(priorities.every((p,i)=>i===0||p.score<=priorities[i-1].score));
});
test('missing, old, failed, invalid and incomplete reports cannot create budget priorities',()=>{
 const {state,range,reports,config}=fixture();assert.deepEqual(todayPriorities(state,{},range,config),[]);
 for(const paid of [{...reports.paid,collectedAt:'2020-01-01T00:00:00Z'},{...reports.paid,collectedAt:'invalid'},{...reports.paid,collectedAt:'2099-01-01T00:00:00Z'},{...reports.paid,start:range.start}])assert.deepEqual(todayPriorities(state,{paid},range,config),[]);
 assert.deepEqual(todayPriorities(state,{paid:reports.paid},range,config,{paid:{at:new Date().toISOString(),error:'Refresh failed'}}),[]);
 assert.equal(reportHealth(undefined,range).label,'Not loaded');
});
test('unverified results prompt measurement before scaling, with tracking checks for zero conversions',()=>{
 const {state,range,reports,config}=fixture();const priorities=todayPriorities(state,reports,range,{...config,adsResultsVerified:false});
 assert(priorities.some(p=>p.id==='verify-results'));assert(!priorities.some(p=>p.title.includes('room to grow')));
 const paid={...reports.paid,rows:reports.paid.rows.map(r=>({...r,conversions:0}))};
 const zero=todayPriorities(state,{paid},range,{...config,adsResultsVerified:false}).find(p=>p.focus.section==='paid');assert(zero);assert.match(zero.why,/tracking/);assert(!zero.observed.includes('Infinity'));
});
test('traffic decline requires a meaningful baseline and valid, unrestricted metrics',()=>{
 const {state,range,reports,config}=fixture();const traffic={...reports.traffic,rows:reports.traffic.rows.map(r=>({...r,sessions:r.date>=range.start?1:100}))};
 assert(todayPriorities(state,{traffic},range,config).some(p=>p.id==='traffic-down'));
 assert.deepEqual(todayPriorities(state,{traffic:{...traffic,limitations:['Thresholded']}},range,config),[]);
 assert.deepEqual(todayPriorities(state,{traffic:{...traffic,rows:traffic.rows.map(r=>({...r,sessions:r.date>=range.start?1:0}))}},range,config),[]);
 assert.deepEqual(todayPriorities(state,{traffic:{...traffic,rows:traffic.rows.map(r=>({...r,sessions:'missing'}))}},range,config),[]);
});
test('follow-up respects brand ownership, dates and completed work',()=>{
 const {state}=fixture();const now=new Date('2026-09-27T12:00:00Z');state.profile.timezone='UTC';
 const task=(title:string,dueDate:string)=>createAction({brandId:state.id,kind:'task',title,owner:'Growth team',dueDate,hypothesis:'Review campaign evidence.',window:7,lagDays:7,direction:'increase',targetPercent:10,evidence:{title,summary:'Review',reference:'Test fixture',capturedAt:now.toISOString()}},now);
 state.actionPlans=[task('Planned','2026-10-01'),task('Today','2026-09-27'),task('Overdue','2026-09-26'),{...task('Other brand','2026-01-01'),brandId:'another-brand'},{...task('Completed','2026-01-01'),status:'completed'}];
 const result=todayFollowUps(state,{},false,{},now);assert.deepEqual(result.map(r=>r.plan.title),['Overdue','Today','Planned']);assert.equal(result[0].label,'Overdue');
});
test('experiment readiness is read-only and refuses sample/live source substitutions',()=>{
 const {state,reports,range}=fixture(),datasets=actionDatasets(state,reports,true),dataset=datasets.find(d=>d.source.kind==='paid')!,now=new Date();
 const plan=createAction({brandId:state.id,kind:'experiment',title:'Test message',owner:'Growth team',dueDate:'',hypothesis:'Clearer copy could improve conversions.',source:dataset.source,metric:'conversions',direction:'increase',targetPercent:10,window:7,lagDays:7,evidence:{title:'Test',summary:'Review',reference:'Test fixture',capturedAt:now.toISOString()}},now);
 state.actionPlans=[recordChange(plan,dayOffset(range.end,-10),'Updated copy.',datasets,now)];const original=JSON.stringify(state.actionPlans);
 const ready=todayFollowUps(state,reports,true,{},now);assert.equal(ready[0].label,'Ready to check results');assert.equal(JSON.stringify(state.actionPlans),original);
 const wrong=todayFollowUps(state,reports,false,{},now);assert.equal(wrong[0].label,'Needs matching data');
 state.actionPlans=[checkResults(state.actionPlans[0],datasets,now)];assert.equal(todayFollowUps(state,{},true,{},now)[0].label,'Ready for your review');
});
