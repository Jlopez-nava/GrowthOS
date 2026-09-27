import Papa from 'papaparse';
import { z } from 'zod';
import { type Metric, type Source, type WorkspaceState, type ImportRecord, type GA4SummaryRow, id } from './types';
export const fields={ga4:['date','entity','sessions','conversions'],gsc:['date','entity','clicks','impressions'],ads:['date','entity','spend','clicks','conversions']} as const;
export type Mapping=Record<string,string>;
export const ImportConfig=z.object({source:z.enum(['ga4','gsc','ads']),account:z.string().trim().min(1).max(100),currency:z.string().regex(/^[A-Z]{3}$/),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),definition:z.string().trim().min(3).max(300),dateFormat:z.enum(['ISO','US','EU']),grain:z.literal('date_entity')});
export type ImportConfig=z.infer<typeof ImportConfig>;
export function parseCSV(text:string){
 if(text.length>2_000_000)throw new Error('File exceeds the 2 MB limit. Split this export by non-overlapping dates.');
 const parsed=Papa.parse<Record<string,string>>(text.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:'greedy',comments:'#',transformHeader:h=>h.trim()});
 if(parsed.errors.length)throw new Error(`CSV row ${(parsed.errors[0].row??0)+2}: ${parsed.errors[0].message}`);
 const headers=parsed.meta.fields??[];
 if(headers.length<2||parsed.data.length===0)throw new Error('No data rows found. Include a header and daily records.');
 if(parsed.data.length>10000)throw new Error('At most 10,000 rows per import.');
 if(new Set(headers).size!==headers.length || parsed.meta.renamedHeaders)throw new Error('Duplicate column headers are not supported.');
 return {headers,rows:parsed.data};
}
export const summaryFields=['entity','sessions','keyEvents','sessionKeyEventRate'] as const;
const aliases:Record<string,string[]>={date:['date','day'],entity:['entity','landingpage','landingpage+querystring','page','toppages','campaign','campaignname'],sessions:['sessions'],conversions:['conversions','convertedsessions','sessionswithkeyevents'],keyEvents:['keyevents'],sessionKeyEventRate:['sessionkeyeventrate'],spend:['spend','cost'],clicks:['clicks'],impressions:['impressions']};
const normalize=(h:string)=>h.toLowerCase().replace(/[\s_]/g,'');
export function isGA4Summary(headers:string[],source:Source){return source==='ga4'&&!headers.some(h=>aliases.date.includes(normalize(h)))&&headers.some(h=>aliases.entity.includes(normalize(h)));}
export function reportMetadata(text:string){
 const value=(name:string)=>text.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.match(new RegExp('^#\\s*'+name+':\\s*(.*?)\\s*$','i'))?.[1]).find(Boolean)??'';
 return {account:value('Property'),start:value('Start date'),end:value('End date')};
}
export function guessMapping(headers:string[],source:Source):Mapping{return Object.fromEntries((isGA4Summary(headers,source)?summaryFields:fields[source]).map(f=>[f,headers.find(h=>aliases[f].includes(normalize(h)))??'']));}
export function parseDate(value:string,format:ImportConfig['dateFormat']){
 let v=value.trim();if(/^\d{8}$/.test(v))v=`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6)}`;
 if(format!=='ISO'&&/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)){const [a,b,c]=v.split('/');v=`${c}-${(format==='US'?a:b).padStart(2,'0')}-${(format==='US'?b:a).padStart(2,'0')}`;}
 const d=new Date(v+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(+d)||d.toISOString().slice(0,10)!==v)throw new Error(`Invalid date “${value}”. Check the selected date format.`);return v;
}
export function parseNumber(value:string|undefined):number|null{if(value===undefined||value.trim()===''||['--','(not set)','null','n/a'].includes(value.trim().toLowerCase()))return null;const v=value.trim();if(!/^\d+(\.\d+)?$/.test(v)&&!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v))throw new Error(`Invalid number “${value}”. Use nonnegative numbers, dot decimals, and optional comma thousands.`);const n=Number(v.replaceAll(',',''));if(!Number.isFinite(n)||n>1e12)throw new Error('Numeric value exceeds the supported range.');return n;}
export function metricKey(m:Metric){return JSON.stringify([m.source,m.account,m.date,m.entity,m.grain]);}
export async function digest(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function prepareImport(text:string,filename:string,mapping:Mapping,input:ImportConfig,state:WorkspaceState,now=new Date()){
 const config=ImportConfig.parse(input);const parsed=parseCSV(text);if(isGA4Summary(parsed.headers,config.source))return prepareSummary(text,filename,mapping,config,state,now);const required=fields[config.source];
 if(required.some(f=>!mapping[f]||!parsed.headers.includes(mapping[f])))throw new Error('Map every required field before validating. Empty metric values are allowed and remain missing.');
 if(new Set(required.map(f=>mapping[f])).size!==required.length)throw new Error('Each field must map to a different column.');
 const importId=id();const seen=new Set<string>();const existing=new Set(state.metrics.map(metricKey));
 const sameAccount=state.imports.filter(i=>i.source===config.source&&i.account===config.account&&i.status==='imported'&&i.grain!=='range_entity');
 if(sameAccount.some(i=>i.currency!==config.currency||i.timezone!==config.timezone||i.definition!==config.definition))throw new Error('This account already uses different currency, timezone, or metric definitions. Use an explicitly separate report account; incompatible reports cannot be combined.');
 const metrics:Metric[]=parsed.rows.map((row,index)=>{try{
 const m:Metric={id:id(),importId,source:config.source,account:config.account,date:parseDate(row[mapping.date]??'',config.dateFormat),entity:(row[mapping.entity]??'').trim(),grain:config.grain,currency:config.currency,timezone:config.timezone,definition:config.definition,collectedAt:now.toISOString(),sessions:null,conversions:null,spend:null,clicks:null,impressions:null};
 if(!m.entity||m.entity.length>2048)throw new Error('A nonempty page or campaign is required.');
 if(m.source==='ga4'&&normalize(mapping.conversions)==='keyevents')throw new Error('Key events count events, not converted sessions. Use converted sessions for daily conversion analysis.');
 for(const f of required){if(f!=='date'&&f!=='entity')m[f]=parseNumber(row[mapping[f]]);}
 if(m.clicks!==null&&m.impressions!==null&&m.clicks>m.impressions)throw new Error('Clicks cannot exceed impressions.');
 if(m.source==='ga4'&&m.sessions!==null&&m.conversions!==null&&m.conversions>m.sessions)throw new Error('Use sessions with a conversion, not total event counts; converted sessions cannot exceed sessions.');
 const key=metricKey(m);if(seen.has(key))throw new Error('Duplicate daily entity, possibly an overlapping report grain. Aggregate extra dimensions before importing.');if(existing.has(key))throw new Error('Overlapping daily entity already imported. Nothing was added.');seen.add(key);return m;
 }catch(e){throw new Error(`Row ${index+2}: ${(e as Error).message}`);}});
 const canonical=metrics.map(m=>JSON.stringify([m.source,m.account,m.date,m.entity,m.currency,m.timezone,m.definition,m.sessions,m.conversions,m.spend,m.clicks,m.impressions])).sort().join('\n');const fingerprint=await digest(canonical);
 if(state.imports.some(i=>i.fingerprint===fingerprint&&i.status==='imported'))throw new Error('This exact dataset has already been imported.');
 const dates=metrics.map(m=>m.date).sort();const record:ImportRecord={id:importId,filename,source:config.source,account:config.account,fingerprint,createdAt:now.toISOString(),rowCount:metrics.length,status:'imported',start:dates[0],end:dates.at(-1)!,currency:config.currency,timezone:config.timezone,definition:config.definition};
 return {record,metrics};
}
function checkSummaryDuplicate(state:WorkspaceState,record:ImportRecord){
 if(state.imports.some(i=>i.status==='imported'&&i.grain==='range_entity'&&i.account===record.account&&(i.fingerprint===record.fingerprint||i.start===record.start&&i.end===record.end&&i.definition===record.definition)))throw new Error('This summary period is already imported for this property. Nothing was added.');
}
async function prepareSummary(text:string,filename:string,mapping:Mapping,config:ImportConfig,state:WorkspaceState,now:Date):Promise<{record:ImportRecord;metrics:Metric[]}>{
 const parsed=parseCSV(text),meta=reportMetadata(text);
 if(!meta.start||!meta.end)throw new Error('GA4 summaries need the original # Start date and # End date lines. Export the complete report as CSV.');
 const start=parseDate(meta.start,'ISO'),end=parseDate(meta.end,'ISO');
 if(start>end)throw new Error('Report start date must be before or equal to its end date.');
 if(summaryFields.some(f=>!mapping[f]||!parsed.headers.includes(mapping[f])))throw new Error('Map Page, Sessions, Key events, and Session key event rate before validating.');
 if(new Set(summaryFields.map(f=>mapping[f])).size!==summaryFields.length)throw new Error('Each field must map to a different column.');
 const seen=new Set<string>();
 const rows:GA4SummaryRow[]=parsed.rows.map((row,index)=>{try{
 const entity=(row[mapping.entity]??'').trim();
 if(!entity||entity.length>2048)throw new Error('A nonempty landing page is required.');
 if(seen.has(entity))throw new Error('Duplicate landing page. Use one row per page without extra dimensions or comparison periods.');seen.add(entity);
 const optional=(name:string)=>parseNumber(row[parsed.headers.find(h=>normalize(h)===name)??'']);
 const sessions=parseNumber(row[mapping.sessions]),keyEvents=parseNumber(row[mapping.keyEvents]);
 const rawRate=row[mapping.sessionKeyEventRate]?.trim()??'';
 let sessionKeyEventRate=parseNumber(rawRate.endsWith('%')?rawRate.slice(0,-1):rawRate);
 if(sessionKeyEventRate!==null&&rawRate.endsWith('%'))sessionKeyEventRate/=100;
 if(sessionKeyEventRate!==null&&sessionKeyEventRate>1)throw new Error('Session key event rate must be a decimal from 0 to 1, or an explicit percentage such as 5.2%.');
 if(sessions===0&&sessionKeyEventRate!==null&&sessionKeyEventRate>0)throw new Error('A positive session key event rate requires sessions.');
 return {entity,sessions,keyEvents,sessionKeyEventRate,activeUsers:optional('activeusers'),newUsers:optional('newusers'),engagementSeconds:optional('averageengagementtimepersession'),revenue:optional('totalrevenue')};
 }catch(e){throw new Error(`Data row ${index+1}: ${(e as Error).message}`);}});
 const fingerprint=await digest(JSON.stringify([config.source,config.account,start,end,config.currency,config.timezone,config.definition,rows.slice().sort((a,b)=>a.entity.localeCompare(b.entity))]));
 const record:ImportRecord={id:id(),filename,source:'ga4',account:config.account,fingerprint,createdAt:now.toISOString(),rowCount:rows.length,status:'imported',start,end,currency:config.currency,timezone:config.timezone,definition:config.definition,grain:'range_entity',summaryRows:rows};
 checkSummaryDuplicate(state,record);
 return {record,metrics:[]};
}
export function commitImport(state:WorkspaceState,prepared:{record:ImportRecord;metrics:Metric[]}):WorkspaceState{
 if(prepared.record.grain==='range_entity')checkSummaryDuplicate(state,prepared.record);
 const keys=new Set(state.metrics.map(metricKey));if(prepared.metrics.some(m=>keys.has(metricKey(m))))throw new Error('Import overlaps existing data. Refresh and validate again.');return {...state,imports:[prepared.record,...state.imports],metrics:[...state.metrics,...prepared.metrics]};
}
