
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  console.log('Checking for null or empty statuses in vw_processes...');
  const { count, error } = await supabase.from('vw_processes')
    .select('*', { count: 'exact', head: true })
    .or('status.is.null,status.eq.""');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Count of null/empty status:', count);
  }

  console.log('Checking for "Pendente" status (case insensitive)...');
  const { count: count2, error: error2 } = await supabase.from('vw_processes')
    .select('*', { count: 'exact', head: true })
    .ilike('status', 'Pendente');
    
  if (error2) {
    console.error('Error 2:', error2);
  } else {
    console.log('Count of "Pendente" (ilike):', count2);
  }
} check();
