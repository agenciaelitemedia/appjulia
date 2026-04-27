import fs from 'node:fs';
const src = fs.readFileSync('supabase/functions/db-query/index.ts','utf8');
const lines = src.split('\n');

// Find case starts
const cases = [];
const caseRe = /^\s*case\s+'([^']+)'\s*:/;
const defRe = /^\s*default\s*:/;
for (let i=0;i<lines.length;i++){
  const m = lines[i].match(caseRe);
  if (m) cases.push({name:m[1], start:i});
}
// determine end of each case
for (let i=0;i<cases.length;i++){
  let end = lines.length-1;
  for (let j=cases[i].start+1;j<lines.length;j++){
    if (caseRe.test(lines[j]) || defRe.test(lines[j])) { end = j-1; break; }
  }
  cases[i].end = end;
}

const out = [];
out.push('# db-query — Action Contracts');
out.push('');
out.push('> Documentação gerada automaticamente a partir de `supabase/functions/db-query/index.ts`.');
out.push('> Cada action é invocada via `supabase.functions.invoke("db-query", { body: { action, data } })`.');
out.push('> Não edite manualmente — re-execute `node /tmp/doc_actions.mjs > supabase/functions/db-query/ACTIONS.md`.');
out.push('');
out.push(`Total de actions: **${cases.length}**`);
out.push('');
out.push('## Índice');
out.push('');
for (const c of cases) out.push(`- [\`${c.name}\`](#${c.name.replace(/_/g,'-')})`);
out.push('');
out.push('---');
out.push('');

for (const c of cases) {
  const body = lines.slice(c.start, c.end+1).join('\n');
  // Extract data.<field> or data?.<field>
  const inputs = new Set();
  const inRe = /\bdata(?:\?\.|\.)([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = inRe.exec(body)) !== null) inputs.add(m[1]);
  // Detect destructured const { a, b } = data
  const destrucRe = /const\s*\{\s*([^}]+)\s*\}\s*=\s*data\b/g;
  while ((m = destrucRe.exec(body)) !== null) {
    m[1].split(',').forEach(p => {
      const name = p.trim().split(/[:=\s]/)[0];
      if (name) inputs.add(name);
    });
  }
  // Detect result =
  const resMatches = [...body.matchAll(/^\s*result\s*=\s*([^;]+);/gm)].map(x => x[1].trim());

  out.push(`## ${c.name}`);
  out.push('');
  out.push(`Linhas: \`${c.start+1}-${c.end+1}\``);
  out.push('');
  out.push('**Payload (`data`):**');
  if (inputs.size === 0) out.push('- _nenhum campo lido de `data`_');
  else for (const k of [...inputs].sort()) out.push(`- \`${k}\``);
  out.push('');
  out.push('**Retorno (`result`):**');
  if (resMatches.length === 0) out.push('- _atribuição direta a `result` não detectada (ver código)_');
  else for (const r of resMatches) {
    const short = r.length > 200 ? r.slice(0,200)+'…' : r;
    out.push('- `' + short.replace(/\s+/g,' ') + '`');
  }
  out.push('');
}

process.stdout.write(out.join('\n'));
