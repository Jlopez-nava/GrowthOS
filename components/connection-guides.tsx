'use client';
import {useState,type ReactNode} from 'react';
import {ArrowDown,ArrowUpRight,BookOpen,FileSpreadsheet,KeyRound,Network,Plug,X} from 'lucide-react';

type GuideId='zapier'|'google'|'mint'|'csv';
type Step={title:string;body:ReactNode};
const choices=[
 {id:'zapier' as const,title:'Zapier MCP',label:'Available',description:'Automatic GA4 & Google Ads reports',icon:Plug},
 {id:'google' as const,title:'Google OAuth',label:'Admin setup',description:'Connect directly to Google',icon:KeyRound},
 {id:'mint' as const,title:'MintMCP',label:'Developer setup required',description:'Plan a managed MCP connection',icon:Network},
 {id:'csv' as const,title:'CSV import',label:'Available',description:'Upload a report without a connector',icon:FileSpreadsheet},
];
function Doc({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14} aria-hidden="true"/></a>;}
export default function ConnectionGuides({onZapier,onGoogle,onImport}:{onZapier:()=>void;onGoogle:()=>void;onImport:()=>void}){
 const [selected,setSelected]=useState<GuideId|null>(null);
 const guides:Record<GuideId,{intro:string;before:string;steps:Step[];success:string;trouble:ReactNode;links:ReactNode;action?:ReactNode}>={
  zapier:{
   intro:'Use the website’s dedicated Zapier server to keep both Google reports up to date.',
   before:'A company admin, a Zapier account, and a Google account with access to your GA4 property and Google Ads account. Adding an app to your chat’s Zapier server does not add it to this website’s server.',
   steps:[
    {title:'Create a server for this website',body:<>Open <Doc href="https://mcp.zapier.com">Zapier MCP</Doc>. Add a separate server for <strong>Other</strong> and name it <strong>SubGrowth Website</strong>.</>},
    {title:'Choose Agentic mode',body:<>In that server, open <strong>Settings → Agentic mode → Save changes</strong>. The website requires this mode.</>},
    {title:'Add both Google apps',body:<>Under <strong>Apps</strong>, add <strong>Google Analytics 4</strong> and <strong>Google Ads</strong>. Select the Google connection that has access to your reports as each app’s default.</>},
    {title:'Enable the reporting actions',body:<>Enable GA4 <strong>Run Report for a Property</strong> and Google Ads <strong>API Request / Make API Mutating Request</strong>. The website uses the Ads action only for a fixed, read-only report query.</>},
    {title:'Save the website connection token',body:<>In this server’s <strong>Connect</strong> tab, generate a connection token. In the website’s <strong>Live Google reports</strong> panel, paste only that token and choose <strong>Save token &amp; load reports</strong>. Keep it out of chat and shared documents.</>},
    {title:'Check both reports',body:<>Look for <strong>Report loaded</strong> under both GA4 and Google Ads. Confirm the account IDs and reporting dates. The website checks on open and offers <strong>Refresh now</strong>; automatic checks reuse results for 15 minutes.</>},
   ],
   success:'Both reports show rows (or a valid empty result) and a last successful update. Each successful report call uses Zapier tasks; cached views do not request a new report.',
   trouble:<>If only one app works, check that <strong>both apps are on SubGrowth Website</strong> and each has a default connection. For a mode error, select Agentic mode. For another failure, open that server’s <strong>History</strong> and inspect the failed action. An active Google sign-in alone does not verify access to a specific Ads account. On a company copy, ask the site owner to configure that company’s reporting IDs.</>,
   links:<><Doc href="https://docs.zapier.com/mcp/manage/switch-modes">Server modes</Doc><Doc href="https://docs.zapier.com/mcp/overview/usage">Usage &amp; billing</Doc></>,
   action:<button className="primary" onClick={onZapier}>Go to Zapier setup <ArrowDown size={16}/></button>,
  },
  google:{
   intro:'Authorize this website directly with Google. This is an alternative to Zapier; it uses the separate Google connection controls below.',
   before:'A company admin and a Google account with access to the data. The site owner must first configure a Google OAuth web client for this deployment.',
   steps:[
    {title:'Check the website’s Google setup',body:<>Open <strong>Optional direct Google connection</strong> below. If it says setup is awaiting server configuration, the owner needs to complete the deployment checklist below.</>},
    {title:'Connect the source you need',body:<>Choose <strong>Connect Google Analytics 4</strong> or <strong>Connect Google Ads</strong>. Sign in to the correct Google account and review the requested permissions. GA4 requests read-only access. Google Ads grants a broader scope; this site implements reporting only.</>},
    {title:'Choose a property or advertising account',body:<>After returning here, select <strong>Load available properties</strong> or <strong>Load available accounts</strong>. Choose the correct property or client account from the list.</>},
    {title:'Sync and verify',body:<>Set the start and end dates, then select <strong>Sync report</strong>. Confirm the account, dates and last successful sync. Repeat for the other source if needed. These direct reports refresh when you choose Sync report.</>},
   ],
   success:'The selected account shows a report and a last successful sync. Direct Google reports and Zapier reports have separate connections and refresh controls.',
   trouble:<>For <strong>redirect_uri_mismatch</strong>, the owner must register the exact callback URL below in Google. If no accounts appear, reconnect with a Google account that has access. If the consent app is in Testing, the owner must add your email as a test user.</>,
   links:<Doc href="https://developers.google.com/identity/protocols/oauth2/web-server">Google OAuth setup</Doc>,
   action:<button className="primary" onClick={onGoogle}>Open Google connection <ArrowDown size={16}/></button>,
  },
  mint:{
   intro:'MintMCP is a gateway for managing access to MCP tools. This site does not yet support a MintMCP connection. The steps below prepare a developer-led integration.',
   before:'A MintMCP admin and a developer who can add the website connector. A gateway connection also needs an underlying server that supplies the required Google reports.',
   steps:[
    {title:'Approve a reporting server',body:<>In MintMCP, open <strong>MCP store</strong>. Approve a suitable server from the catalog, or add your organization’s remote MCP server. Verify that it actually exposes the reports you need.</>},
    {title:'Set up an identity for the website',body:<>Have the admin create a dedicated <strong>agent identity</strong>, select its connectors and limit its tools to the required reporting operations. Configure the downstream account access.</>},
    {title:'Prepare the developer handoff',body:<>Provide the gateway endpoint and approved tool schemas to the developer. Provision a dedicated bearer key or machine-to-machine authentication through secure server configuration. MintMCP credentials cannot be used in the Zapier token field.</>},
    {title:'Implement and test the site connector',body:<>The developer must add server-side authentication, map the report fields, and connect the refresh controls. Verify the correct account, reporting dates and access restrictions before enabling it for the company.</>},
   ],
   success:'Setup is complete only after the website connector is implemented and a live report is verified. Approving a server in MintMCP by itself does not connect this site.',
   trouble:<>Until the connector is built, use Zapier, direct Google OAuth, or CSV import. No MintMCP credentials are collected on this page.</>,
   links:<><Doc href="https://www.mintmcp.com/docs/quickstart">MintMCP quickstart</Doc><Doc href="https://www.mintmcp.com/docs/agent-identities">Agent identities</Doc></>,
  },
  csv:{
   intro:'Test with a downloaded report or a labeled sample file. No provider account connection is needed.',
   before:'A UTF-8, comma-separated CSV, up to 2 MB and 10,000 rows. Choose the intended workspace before importing.',
   steps:[
    {title:'Export a supported report',body:<>For daily analysis, use one row per day and page (GA4 or Search Console), or day and campaign (Google Ads). Keep extra dimensions and total rows out. Native GA4 landing-page summary exports are also supported.</>},
    {title:'Open Import CSV',body:<>Select the source and enter its account or property ID, reporting currency and timezone. Choose your file. For a first test, download a labeled sample below.</>},
    {title:'Map and validate',body:<>Match your columns, then choose <strong>Validate &amp; preview</strong>. For Ads, spend must be in currency units, not micros. For daily GA4 conversion analysis, use converted sessions; total key events are a different metric.</>},
    {title:'Review and import',body:<>Check the row count, dates and preview. Choose <strong>Import &amp; find opportunities</strong> for daily data, or <strong>Import summary</strong> for a GA4 range summary. Confirm the entry in Import history.</>},
   ],
   success:'Daily records can feed the recommendation engine. GA4 range summaries appear in Performance and do not generate daily trend recommendations. CSV data updates only when you import another file.',
   trouble:<>If a date or metric fails validation, correct the mapping or export and preview again. Keep GA4 summary date-range header notes in the file. Imports in a browser sandbox stay in that browser; choose a configured company workspace to share them with your team.</>,
   links:<><a href="/samples/ga4.csv" download>GA4 sample <FileSpreadsheet size={14}/></a><a href="/samples/ads.csv" download>Google Ads sample <FileSpreadsheet size={14}/></a><a href="/samples/gsc.csv" download>Search Console sample <FileSpreadsheet size={14}/></a></>,
   action:<button className="primary" onClick={onImport}>Import CSV <FileSpreadsheet size={16}/></button>,
  },
 };
 const guide=selected?guides[selected]:null;
 return <section className="connection-guides" aria-labelledby="connection-guide-title">
  <div className="guide-heading"><div><span className="eyebrow"><BookOpen size={15} aria-hidden="true"/> CONNECTION GUIDES</span><h1 id="connection-guide-title">Connect your data, step by step.</h1><p>Choose a method for setup instructions, a success check, and help with common errors.</p></div></div>
  <div className="guide-options">{choices.map(({id,title,label,description,icon:Icon})=><button key={id} id={`guide-choice-${id}`} className={`guide-option ${selected===id?'is-selected':''}`} onClick={()=>setSelected(selected===id?null:id)} aria-expanded={selected===id} aria-controls="connection-guide-detail"><Icon size={21} aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small><span className={`guide-label ${id==='mint'?'guide-label-pending':''}`}>{label}</span></span><ArrowDown size={16} className="guide-option-arrow" aria-hidden="true"/></button>)}</div>
  <div id="connection-guide-detail" hidden={!guide}>{guide&&selected&&<article className="guide-detail" aria-labelledby="selected-guide-title"><div className="guide-detail-heading"><div><span className="eyebrow">SETUP GUIDE</span><h2 id="selected-guide-title">{choices.find(c=>c.id===selected)?.title}</h2><p>{guide.intro}</p></div><button className="icon-button" aria-label="Close setup guide" onClick={()=>{document.getElementById(`guide-choice-${selected}`)?.focus();setSelected(null);}}><X size={20}/></button></div><div className="guide-before"><strong>Before you start</strong><p>{guide.before}</p></div><ol className="guide-steps">{guide.steps.map((step,i)=><li key={step.title}><span className="guide-step-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>{selected==='google'&&<details className="guide-help"><summary>For the site owner: configure a company deployment</summary><ol><li>In Google Cloud, enable the Analytics Data API, Analytics Admin API and Google Ads API for the sources you need.</li><li>Configure Google Auth Platform branding, audience and scopes. While in Testing, add the people who will authorize the app as test users.</li><li>Create an OAuth client of type <strong>Web application</strong>. Register <code>https://YOUR-SITE/api/google/oauth/callback</code>, replacing YOUR-SITE with this deployment’s exact hostname.</li><li>Have the deployment owner securely configure <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_APP_ORIGIN</code> and the company’s encrypted storage. Use each company’s own credentials when cloning.</li><li>Return to the Google connection controls, authorize a source and verify a real report. Never paste the client secret into the Zapier field.</li></ol></details>}<div className="guide-success"><strong>How to know it worked</strong><p>{guide.success}</p></div><details className="guide-help"><summary>Troubleshooting</summary><p>{guide.trouble}</p></details><div className="guide-footer"><div className="guide-links">{guide.links}</div>{guide.action}</div></article>}</div>
 </section>;
}
