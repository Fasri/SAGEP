const fs = require('fs');
const angularJson = JSON.parse(fs.readFileSync('angular.json', 'utf8'));
const define = angularJson.projects.app.architect.build.options.define;
const url = define.SUPABASE_URL.replace(/'/g, '');
const key = define.SUPABASE_ANON_KEY.replace(/'/g, '');

async function run() {
  const res = await fetch(url + '/rest/v1/vw_processes?select=*&limit=1', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const data = await res.json();
  console.log(Object.keys(data[0] || {}));
}
run();
