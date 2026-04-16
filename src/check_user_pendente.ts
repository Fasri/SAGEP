
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  const userId = '7a78bb7f-42d4-4ea0-9100-54faff68b72e';
  
  console.log('Checking "Pendente" + "assigned_to_id" for user...');
  const { count, error } = await supabase.from('vw_processes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pendente')
    .eq('assigned_to_id', userId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Count for user:', count);
  }

  console.log('Checking "Todos" + "assigned_to_id" for user...');
  const { data, error: error2 } = await supabase.from('vw_processes')
    .select('status')
    .eq('assigned_to_id', userId)
    .limit(10);
    
  if (error2) {
    console.error('Error 2:', error2);
  } else {
    console.log('Statuses for user (first 10):', data.map(d => d.status));
  }
} check();
