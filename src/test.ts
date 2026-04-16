import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const angularJson = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const define = angularJson.projects.app.architect.build.options.define;
const url = define.SUPABASE_URL.replace(/'/g, '');
const key = define.SUPABASE_ANON_KEY.replace(/'/g, '');
const supabase = createClient(url, key);
supabase.from('vw_processes').select('entry_date, status, assigned_to_id').limit(5).then((res) => {
  console.log('Sample Data:', JSON.stringify(res.data, null, 2));
  if (res.data && res.data.length > 0) {
    const firstDate = res.data[0].entry_date;
    console.log('Type of entry_date:', typeof firstDate);
  }
});
