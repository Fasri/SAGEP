
import { createClient } from '@supabase/supabase-js';

const url = process.env['SUPABASE_URL'] || '';
const key = process.env['SUPABASE_ANON_KEY'] || '';

const supabase = createClient(url, key);

async function check() {
  console.log('Testing eq("status", "Pendente")...');
  const { count: c1, error: e1 } = await supabase.from('vw_processes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pendente');
  
  if (e1) console.error('Error 1:', e1);
  else console.log('Count eq:', c1);

  console.log('Testing ilike("status", "Pendente")...');
  const { count: c2, error: e2 } = await supabase.from('vw_processes')
    .select('*', { count: 'exact', head: true })
    .ilike('status', 'Pendente');
    
  if (e2) console.error('Error 2:', e2);
  else console.log('Count ilike:', c2);
} check();
