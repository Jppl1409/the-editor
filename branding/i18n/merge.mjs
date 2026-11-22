// Junta as traduções (branding/i18n/chunks/out-*.json) no dicionário do app
// (apps/web/src/i18n/pt-BR.json), validando cada entrada. Entradas já existentes no dicionário
// são mantidas, a não ser que um lote novo traga outra tradução para a mesma chave.
//
//   node branding/i18n/merge.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dictFile = path.resolve(here, "../../apps/web/src/i18n/pt-BR.json");
const chunks = path.join(here, "chunks");

function decodeEntities(s) {
  const named = { apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", rarr: "→", larr: "←", times: "×", copy: "©", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (named[e.toLowerCase()] ?? m),
  );
}

const dict = existsSync(dictFile) ? JSON.parse(readFileSync(dictFile, "utf8")) : {};
const problems = [];
let added = 0;
// Os lotes primeiro; manual.json (correções à mão, versionado) por último, para sempre ganhar.
const files = [
  ...(existsSync(chunks) ? readdirSync(chunks).filter((f) => /^out-.*\.json$/.test(f)).sort().map((f) => path.join(chunks, f)) : []),
  path.join(here, "manual.json"),
].filter((f) => existsSync(f));
for (const file of files) {
  const f = path.basename(file);
  let obj;
  try {
    obj = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${f}: JSON inválido (${e.message})`);
    continue;
  }
  for (let [k, v] of Object.entries(obj)) {
    if (typeof v !== "string" || !v.trim()) continue;
    k = decodeEntities(k);
    // packages/core não passa pelo rebrand: a chave fica "OpenReel" (é o que aparece), a tradução diz "The Editor".
    v = decodeEntities(v).replace(/OpenReel(?![A-Za-z_])/g, "The Editor");
    if (k === v) continue;
    // A tradução pode repetir uma variável ("clipe{1} selecionado{1}") ou largar o "s" de plural ({1}),
    // mas não pode inventar uma que não existe nem perder o número principal ({0}).
    const need = new Set(k.match(/\{\d+\}/g) ?? []);
    const have = new Set(v.match(/\{\d+\}/g) ?? []);
    if ([...have].some((x) => !need.has(x)) || (need.has("{0}") && !have.has("{0}"))) {
      problems.push(`${f}: variáveis diferentes em ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
      continue;
    }
    if (dict[k] !== v) added++;
    dict[k] = v;
  }
}
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(dictFile, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`${files.length} arquivos, ${added} entradas novas/alteradas, total ${Object.keys(sorted).length}`);
if (problems.length) console.log(`Descartadas (${problems.length}):\n  ${problems.slice(0, 40).join("\n  ")}`);
