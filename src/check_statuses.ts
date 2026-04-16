
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  console.log('Checking distinct statuses in vw_processes...');
  const { data, error } = await supabase.from('vw_processes').select('status');
  
  if (error) {
    console.error('Error:', error);
  } else {
    const statuses = [...new Set(data.map(d => d.status))];
    console.log('Statuses found:', statuses.map(s => `[${s}]`));
  }
} check();
