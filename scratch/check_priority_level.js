
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

async function checkGeneratedColumn() {
  const { data, error } = await supabase.rpc('get_column_definition', { t_name: 'processes', c_name: 'priority_level' });
  
  if (error) {
    console.log('RPC failed, trying query on information_schema');
    // We might not have permission to information_schema via anon key, but let's see.
    const { data: info, error: infoError } = await supabase.from('information_schema.columns')
      .select('column_name, is_generated, generation_expression')
      .eq('table_name', 'processes')
      .eq('column_name', 'priority_level');
    
    if (infoError) console.error('Info Schema failed:', infoError);
    else console.log('Info Schema:', info);
  } else {
    console.log('Definition:', data);
  }
}

checkGeneratedColumn();
