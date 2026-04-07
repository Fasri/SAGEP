const fs = require('fs');
const angularJson = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const define = angularJson.projects.app.architect.build.options.define;
const url = define.SUPABASE_URL.replace(/'/g, '');
const key = define.SUPABASE_ANON_KEY.replace(/'/g, '');

async function run() {
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
