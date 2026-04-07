async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  let allPendentes = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const res = await fetch(url + `/rest/v1/processes?status=eq.Pendente&select=id,priority,entry_date,nucleus&limit=${limit}&offset=${offset}`, {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const pendentes = await res.json();
    if (pendentes.length === 0) break;
    allPendentes = allPendentes.concat(pendentes);
    offset += limit;
  }
  
  console.log('Total pending:', allPendentes.length);
  
  // Group by nucleus
  const byNucleus = {};
  for (const p of allPendentes) {
    if (!byNucleus[p.nucleus]) byNucleus[p.nucleus] = [];
    byNucleus[p.nucleus].push(p);
  }
  
  for (const nucleus of Object.keys(byNucleus)) {
    const sorted = byNucleus[nucleus].sort((a, b) => {
      const levelA = a.priority.toUpperCase().includes('SUPER') ? 1 : 2;
      const levelB = b.priority.toUpperCase().includes('SUPER') ? 1 : 2;
      if (levelA !== levelB) return levelA - levelB;
      return new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
    });
    
    console.log(`Updating ${sorted.length} processes for nucleus ${nucleus}...`);
    
    // Update sequentially
    for (let i = 0; i < sorted.length; i++) {
      const updateRes = await fetch(url + `/rest/v1/processes?id=eq.${sorted[i].id}`, {
        method: 'PATCH',
        headers: { 
          'apikey': key, 
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ position: i + 1 })
      });
      if (!updateRes.ok) {
        console.error('Failed to update', sorted[i].id, await updateRes.text());
      }
    }
  }
  console.log('Done!');
}
run();
