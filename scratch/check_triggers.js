
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'processes' });
  if (error) {
    console.log('Failed to check triggers via RPC, checking audit logs for hints');
    const { data: logs } = await supabase.from('audit_logs').select('action').limit(5);
    console.log('Sample logs:', logs);
  } else {
    console.log('Triggers:', data);
  }
}

checkTriggers();
