const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) continue;

    const value = line.slice(equalsIndex + 1).trim();
    process.env[key] = value;
  }
}

function asDefine(name, value) {
  const safeValue = String(value || '').replace(/'/g, "\\'");
  return `--define=${name}='${safeValue}'`;
}

loadDotEnv(envPath);

const target = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!target || (target !== 'serve' && target !== 'build')) {
  console.error('Usage: node scripts/ng-env-runner.cjs <serve|build> [args...]');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || '';
const storagePath = process.env.SUPABASE_STORAGE_FILE_PATH || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

const defineArgs = [
  asDefine('SUPABASE_URL', supabaseUrl),
  asDefine('SUPABASE_ANON_KEY', supabaseAnonKey),
  asDefine('SUPABASE_STORAGE_BUCKET', storageBucket),
  asDefine('SUPABASE_STORAGE_FILE_PATH', storagePath),
];

if (target === 'serve') {
  defineArgs.unshift(asDefine('GEMINI_API_KEY', geminiApiKey));
}

const result = spawnSync('npx', ['ng', target, ...extraArgs, ...defineArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
