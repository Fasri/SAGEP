async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  const res = await fetch(url + '/rest/v1/processes?status=eq.Pendente&select=id', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'count=exact' }
  });
  console.log('Total pending:', res.headers.get('content-range'));
}
run();
