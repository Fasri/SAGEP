async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  const res = await fetch(url + '/rest/v1/processes?status=eq.Pendente&select=id,position,nucleus&limit=5', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  console.log('Processes:', data);
}
run();
