async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('No env vars');
    return;
  }
  const res = await fetch(url + '/rest/v1/vw_processes?status=eq.Pendente&position=eq.0&select=id,nucleus', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  console.log('Count of position 0:', data.length);
  if (data.length > 0) {
    console.log('Nuclei:', [...new Set(data.map(d => d.nucleus))]);
  }
}
run();
