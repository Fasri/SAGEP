
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  const userId = '7a78bb7f-42d4-4ea0-9100-54faff68b72e';
  
  console.log('Checking "Pendente" + "assigned_to_id" with dates...');
  const { data, error } = await supabase.from('vw_processes')
    .select('entry_date, status')
    .eq('status', 'Pendente')
    .eq('assigned_to_id', userId)
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample pending processes:', data);
  }
} check();
