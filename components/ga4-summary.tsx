'use client';
import {useState} from 'react';
import PerformanceHelp from './performance-help';
import {type ImportRecord,type GA4SummaryRow} from '@/lib/domain/types';

const number=(n:number|null)=>n===null?'Unavailable':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export function SummaryTable({rows}:{rows:GA4SummaryRow[]}){
 return <div className="table-scroll ga4-summary-table"><table><thead><tr><th>Landing page<PerformanceHelp topic="landing"/></th><th>Sessions<PerformanceHelp topic="sessions"/></th><th>Key events<PerformanceHelp topic="keyEvents"/></th><th>Session key event rate<PerformanceHelp topic="sessionRate"/></th><th>Active users<PerformanceHelp topic="activeUsers"/></th><th>New users<PerformanceHelp topic="newUsers"/></th><th>Avg. engagement (s)<PerformanceHelp topic="engagementTime"/></th><th>Total revenue<PerformanceHelp topic="revenue"/></th></tr></thead><tbody>{rows.map(r=><tr key={r.entity}><td>{r.entity}</td><td>{number(r.sessions)}</td><td>{number(r.keyEvents)}</td><td>{r.sessionKeyEventRate===null?'Unavailable':`${(r.sessionKeyEventRate*100).toFixed(2)}%`}</td><td>{number(r.activeUsers)}</td><td>{number(r.newUsers)}</td><td>{number(r.engagementSeconds)}</td><td>{number(r.revenue)}</td></tr>)}</tbody></table></div>;
}
export default function GA4Summaries({reports}:{reports:ImportRecord[]}){
 const [chosen,setChosen]=useState('');
 const report=reports.find(r=>r.id===chosen)??reports[0];
 if(!report)return null;
 return <section className="panel" aria-label="GA4 landing-page summaries"><div className="section-heading"><h2>Landing-page summary<PerformanceHelp topic="landing"/></h2><span className="badge">Date-range totals</span></div><label>Report period<select value={report.id} onChange={e=>setChosen(e.target.value)}>{reports.map(r=><option key={r.id} value={r.id}>{r.start} – {r.end} · {r.filename}</option>)}</select></label><p><strong>{report.account}</strong> · {report.start} – {report.end} · {report.currency} · {report.timezone}</p><div className="notice">This report contains totals for the selected period. Summaries are viewed separately and never added to daily records or to other periods. Daily trend recommendations need a report with a Date column.</div><SummaryTable rows={report.summaryRows??[]}/><p className="subtle">{report.rowCount} landing pages · {report.definition}. Key events count occurrences; session key event rate is the exported proportion of sessions with a key event. Rates are not calculated from key-event counts. User counts are not added across pages.</p><p className="subtle">Collected {new Date(report.createdAt).toLocaleString()}. “(not set)” is preserved as reported. Confirm currency and timezone against your GA4 property.</p></section>;
}
