import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const angularJson = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const define = angularJson.projects.app.architect.build.options.define;
const url = define.SUPABASE_URL.replace(/'/g, '');
const key = define.SUPABASE_ANON_KEY.replace(/'/g, '');
const supabase = createClient(url, key);
supabase.from('vw_processes').select('*').limit(1).then((res) => console.log(Object.keys(res.data?.[0] || {})));
