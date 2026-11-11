/**
 * Load Test - Simula 60 usuários simultâneos na VPS
 * Uso: node scripts/load-test.cjs [URL_BASE] [NUM_USUARIOS] [DURACAO_SEG]
 *
 * Exemplo: node scripts/load-test.cjs http://163.176.3.36 60 30
 */

const BASE_URL = process.argv[2] || 'http://163.176.3.36';
const NUM_USERS = parseInt(process.argv[3] || '60', 10);
const DURATION_SEC = parseInt(process.argv[4] || '30', 10);

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoicG9zdGdyZXMiLCJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjUyNDYwODAwMH0.a2hX_zHgj8p0XLZBMIYEmWwdxn2-RiHo_kgNOc14sNo';

const HEADERS = {
  'apikey': JWT,
  'Authorization': `Bearer ${JWT}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Queries que o app faz ao carregar (simula login + dashboard)
const QUERIES = [
  { name: 'users',       path: '/users?select=*' },
  { name: 'nucleos',     path: '/nucleos?select=*' },
  { name: 'prioridades', path: '/prioridades?select=*' },
  { name: 'status',      path: '/status?select=*' },
  { name: 'vw_processes',path: '/vw_processes?select=*&order=priority_level.asc,position.asc&limit=100' },
  { name: 'audit_logs',  path: '/audit_logs?select=created_at&order=created_at.desc&limit=1' },
];

// Métricas por endpoint
const metrics = {};
QUERIES.forEach(q => {
  metrics[q.name] = { success: 0, error: 0, times: [] };
});

let totalRequests = 0;
let running = true;

// ─────────────────────────────────────────────
// Função de requisição com medição de tempo
// ─────────────────────────────────────────────
async function fetchQuery(query) {
  const url = `${BASE_URL}${query.path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const elapsed = Date.now() - start;

    if (res.ok) {
      metrics[query.name].success++;
      metrics[query.name].times.push(elapsed);
    } else {
      metrics[query.name].error++;
      if (elapsed < 2000) metrics[query.name].times.push(elapsed);
    }
  } catch {
    metrics[query.name].error++;
  }
  totalRequests++;
}

// ─────────────────────────────────────────────
// Loop de um usuário virtual
// ─────────────────────────────────────────────
async function virtualUser(userId) {
  while (running) {
    // Cada usuário faz as queries em sequência (como o app faz)
    for (const query of QUERIES) {
      if (!running) break;
      await fetchQuery(query);
      // Pausa curta entre queries do mesmo usuário (simula tempo de render)
      await new Promise(r => setTimeout(r, Math.random() * 200 + 50));
    }
    // Pausa entre "ciclos" de refresh (simula usuário trabalhando)
    await new Promise(r => setTimeout(r, Math.random() * 3000 + 1000));
  }
}

// ─────────────────────────────────────────────
// Função de estatísticas
// ─────────────────────────────────────────────
function calcStats(times) {
  if (!times.length) return { min: 0, avg: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...times].sort((a, b) => a - b);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min: sorted[0], avg, p95, p99, max: sorted[sorted.length - 1] };
}

function printProgress() {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  process.stdout.write(`\r  ⏱  ${elapsed}s | 📨 ${totalRequests} reqs | Usuários: ${NUM_USERS} ativos...`);
}

// ─────────────────────────────────────────────
// INÍCIO DO TESTE
// ─────────────────────────────────────────────
console.log('\n╔════════════════════════════════════════════════════╗');
console.log(`║  🚀 LOAD TEST - ${NUM_USERS} usuários por ${DURATION_SEC}s`);
console.log(`║  🎯 Alvo: ${BASE_URL}`);
console.log('╚════════════════════════════════════════════════════╝\n');

// Verifica conectividade antes
console.log('🔍 Verificando conectividade...');
fetch(`${BASE_URL}/users?limit=1`, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log('✅ Servidor respondendo. Iniciando teste...\n');
    runTest();
  })
  .catch(err => {
    console.error(`❌ Falha na conectividade: ${err.message}`);
    console.error('   Verifique se o Nginx está configurado e o PostgREST está rodando.');
    process.exit(1);
  });

const startTime = Date.now();

async function runTest() {
  // Sobe usuários virtuais em paralelo (ramp-up de 3s para não saturar de vez)
  const rampDelay = Math.min(3000 / NUM_USERS, 100);
  const users = [];

  for (let i = 0; i < NUM_USERS; i++) {
    await new Promise(r => setTimeout(r, rampDelay));
    users.push(virtualUser(i));
  }

  // Progress ticker
  const ticker = setInterval(printProgress, 500);

  // Para o teste após DURATION_SEC
  await new Promise(r => setTimeout(r, DURATION_SEC * 1000));
  running = false;
  clearInterval(ticker);

  // Aguarda últimas requests terminarem
  await new Promise(r => setTimeout(r, 2000));

  // ─── RELATÓRIO FINAL ───
  const totalDuration = (Date.now() - startTime) / 1000;
  const rps = Math.round(totalRequests / totalDuration);

  console.log('\n\n╔════════════════════════════════════════════════════╗');
  console.log('║               📊 RELATÓRIO DE CARGA                ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log(`  ⏱  Duração total:    ${totalDuration.toFixed(1)}s`);
  console.log(`  📨  Total requests:   ${totalRequests}`);
  console.log(`  🔥  Throughput:       ${rps} req/s`);
  console.log(`  👥  Usuários simulados: ${NUM_USERS}\n`);

  let totalSuccess = 0;
  let totalErrors = 0;

  console.log('  ┌─────────────────┬────────┬───────┬──────┬──────┬──────┬───────┐');
  console.log('  │ Endpoint        │ Sucesso│ Erro  │ Min  │ Avg  │ p95  │ Max   │');
  console.log('  ├─────────────────┼────────┼───────┼──────┼──────┼──────┼───────┤');

  for (const [name, m] of Object.entries(metrics)) {
    const s = calcStats(m.times);
    totalSuccess += m.success;
    totalErrors += m.error;
    const label = name.padEnd(15);
    const ok = String(m.success).padStart(6);
    const err = String(m.error).padStart(5);
    const errMark = m.error > 0 ? ' ⚠' : '';
    console.log(`  │ ${label} │${ok}  │${err}  │${String(s.min+'ms').padStart(5)} │${String(s.avg+'ms').padStart(5)} │${String(s.p95+'ms').padStart(5)} │${String(s.max+'ms').padStart(6)} │${errMark}`);
  }

  console.log('  └─────────────────┴────────┴───────┴──────┴──────┴──────┴───────┘\n');

  const errorRate = ((totalErrors / (totalSuccess + totalErrors)) * 100).toFixed(1);

  console.log(`  ✅ Sucessos:   ${totalSuccess}`);
  console.log(`  ❌ Erros:      ${totalErrors} (${errorRate}%)\n`);

  // Avaliação
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │           🏆 AVALIAÇÃO FINAL             │');
  console.log('  └─────────────────────────────────────────┘\n');

  const allTimes = Object.values(metrics).flatMap(m => m.times);
  const globalStats = calcStats(allTimes);

  if (parseFloat(errorRate) < 1 && globalStats.p95 < 500) {
    console.log('  ✅ ÓTIMO: VPS aguenta 60 usuários com excelente performance!');
    console.log(`     p95 = ${globalStats.p95}ms (abaixo de 500ms)`);
    console.log('     👉 Pode migrar com confiança.\n');
  } else if (parseFloat(errorRate) < 5 && globalStats.p95 < 2000) {
    console.log('  🟡 ACEITÁVEL: VPS aguenta mas começa a sentir pressão.');
    console.log(`     p95 = ${globalStats.p95}ms | Erros = ${errorRate}%`);
    console.log('     👉 Funciona, mas monitore. Considere caching no Nginx.\n');
  } else {
    console.log('  🔴 ATENÇÃO: VPS está saturando com 60 usuários simultâneos!');
    console.log(`     p95 = ${globalStats.p95}ms | Erros = ${errorRate}%`);
    console.log('     👉 Precisa de mais recursos ou otimizações antes de migrar.\n');
  }

  console.log('  💡 DICAS PARA MONITORAR A VPS DURANTE O TESTE:');
  console.log('     docker stats                  → CPU/RAM por container');
  console.log('     htop                          → CPU/RAM geral');
  console.log('     docker logs postgrest -f      → erros do PostgREST\n');
}

