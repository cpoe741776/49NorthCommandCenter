// scripts/list-ticker-imports.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = './src';
const TARGET = './services/tickerService';

const hits = new Map();

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(extname(p))) scanFile(p);
  }
}

function scanFile(file) {
  const txt = readFileSync(file, 'utf8');
  const rx = /import\s*\{([^}]+)\}\s*from\s*['"]\.\/services\/tickerService['"]/g;
  let m;
  while ((m = rx.exec(txt))) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    names.forEach(n => {
      hits.set(n, [...(hits.get(n) || []), file]);
    });
  }
}

walk(ROOT);
console.log('Named imports found from', TARGET, ':\n');
for (const [name, files] of hits.entries()) {
  console.log(`- ${name} ${files.length > 1 ? `(${files.length} uses)` : ''}`);
  files.forEach(f => console.log(`   • ${f}`));
}
