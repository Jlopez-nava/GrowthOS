import {writeFileSync} from 'node:fs';
import {makeDemo} from '../lib/domain/demo';
import {fields} from '../lib/domain/imports';
import type {Source} from '../lib/domain/types';
const state=makeDemo();
for(const source of ['ga4','gsc','ads'] as Source[]){const columns=fields[source];const csv=['# SYNTHETIC SAMPLE DATA — not real marketing performance',columns.join(','),...state.metrics.filter(m=>m.source===source).map(m=>columns.map(c=>m[c]??'').join(','))].join('\n');writeFileSync(`public/samples/${source}.csv`,csv+'\n');}
console.log('Generated three labelled, daily-grain sample files.');
