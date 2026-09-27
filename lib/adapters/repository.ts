import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type WorkspaceState, type Profile, emptyWorkspace } from '../domain/types';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured=Boolean(url&&key);
let client:SupabaseClient|null=null;
export function supabase(){if(!url||!key)throw new Error('Supabase is not configured. Use the browser sandbox or follow README setup.');return client??=createClient(url,key);}
const tables={imports:'imports',metrics:'daily_metrics',recommendations:'recommendations',drafts:'drafts',decisions:'decisions',measurements:'measurement_plans',brandVersions:'brand_documents'} as const;
export async function listWorkspaces(){const {data,error}=await supabase().from('workspaces').select('id,profile,revision').order('created_at');if(error)throw error;return data??[];}
export async function loadCloud(workspaceId:string):Promise<WorkspaceState>{
 const {data,error}=await supabase().from('workspaces').select('id,profile,rules,revision').eq('id',workspaceId).single();if(error)throw error;
 const state={...emptyWorkspace('cloud'),...data,mode:'cloud' as const};
 for(const [field,table] of Object.entries(tables)){
 // Explicit pagination: never silently truncate to the Supabase default 1000 rows.
 const all:unknown[]=[];for(let offset=0;;offset+=500){const response=await supabase().from(table).select('payload').eq('workspace_id',workspaceId).order('id').range(offset,offset+499);if(response.error)throw response.error;all.push(...response.data.map(r=>r.payload));if(response.data.length<500)break;}
 Object.assign(state,{[field]:all});}
 return state;
}
export async function createCloud(profile:Profile):Promise<WorkspaceState>{const state=emptyWorkspace('cloud');const {data,error}=await supabase().rpc('create_workspace',{p_profile:profile,p_rules:state.rules});if(error)throw error;return loadCloud(data);}
export async function saveCloud(state:WorkspaceState):Promise<WorkspaceState>{if(state.mode!=='cloud')throw new Error('Demo and sandbox data cannot be written to Supabase.');const {data,error}=await supabase().rpc('save_workspace',{p_workspace:state.id,p_expected_revision:state.revision,p_state:state});if(error)throw error;return {...state,revision:data};}
export function loadLocal(mode:'demo'|'sandbox'):WorkspaceState|null{const raw=localStorage.getItem(`growthos:v1:${mode}`);if(!raw)return null;const state=JSON.parse(raw) as WorkspaceState;if(state.mode!==mode||!Array.isArray(state.metrics)||!Array.isArray(state.drafts))throw new Error('Saved browser data could not be read. Export it from browser storage before resetting.');return state;}
export function saveLocal(state:WorkspaceState){if(!['demo','sandbox'].includes(state.mode))throw new Error('Shared workspaces cannot use local demo persistence.');localStorage.setItem(`growthos:v1:${state.mode}`,JSON.stringify(state));}
