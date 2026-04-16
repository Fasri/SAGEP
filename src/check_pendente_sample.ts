
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  console.log('Fetching sample "Pendente" records...');
  const { data, error } = await supabase.from('vw_processes')
    .select('status')
    .ilike('status', 'Pendente')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Statuses found:', data.map(d => `[${d.status}]`));
  }
} check();
