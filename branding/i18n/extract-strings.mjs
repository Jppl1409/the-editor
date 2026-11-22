// Extrai do código-fonte do app (apps/web/src) os textos de interface em inglês, para montar o
// dicionário de tradução (apps/web/src/i18n/pt-BR.json). Rodar de novo depois de puxar o upstream:
//
//   node branding/i18n/extract-strings.mjs            -> branding/i18n/strings.json (todas)
//   node branding/i18n/extract-strings.mjs --missing  -> só as que ainda não estão no pt-BR.json
//
// Textos com variáveis (`${n} clips selected`) viram padrões "{0} clips selected".
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const webSrc = path.join(root, "apps/web/src");
// Pacotes que também desenham interface (rótulos de tarefas, componentes de UI).
const SOURCES = [webSrc, path.join(root, "packages/ui/src"), path.join(root, "packages/core/src")];
const ts = createRequire(path.join(root, "apps/web/package.json"))("typescript");

const SKIP_DIR = /[\\/](test|e2e|workers|__tests__|__mocks__)([\\/]|$)/;
const SKIP_FILE = /\.(test|spec|stories)\.tsx?$|\.d\.ts$/;
// Atributos JSX que nunca são texto visível.
const NON_TEXT_ATTRS = new Set([
  "className", "class", "id", "key", "href", "src", "type", "role", "variant", "size", "side", "align",
  "name", "value", "defaultValue", "htmlFor", "target", "rel", "autoComplete", "inputMode", "mode",
  "orientation", "dir", "lang", "style", "accept", "method", "action", "form", "pattern", "testId",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIR.test(p + path.sep) && name !== "node_modules") walk(p, out);
    } else if (/\.tsx?$/.test(name) && !SKIP_FILE.test(name)) out.push(p);
  }
  return out;
}

/** Same whitespace rule React/TS use for JSX text. */
function normalizeJsxText(raw) {
  return raw
    .split(/\r?\n/)
    .map((l, i, a) => (i === 0 ? l.replace(/\s+$/, "") : i === a.length - 1 ? l.replace(/^\s+/, "") : l.trim()))
    .filter((l) => l.length > 0)
    .join(" ")
    .trim();
}

/** Entidades HTML do JSX viram o caractere que aparece na tela ("don&apos;t" -> "don't"). */
function decodeEntities(s) {
  const named = { apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", rarr: "→", larr: "←", times: "×", copy: "©", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (named[e.toLowerCase()] ?? m),
  );
}

function looksLikeUiText(s) {
  const t = s.trim();
  if (t.length < 2 || t.length > 240) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  if (/^(https?:|mailto:|data:|blob:|app:|\.{0,2}\/|#|@|--)/.test(t)) return false;
  if (/\\|=>|[{}<>;]|\$\(|^\w+\(|\.(tsx?|jsx?|css|json|png|svg|mp4|wasm)\b/.test(t)) return false;
  if (/^[a-z0-9_.:/-]+$/.test(t)) return false; // identificador, classe, chave
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 4) return false; // CONSTANTE
  const words = t.split(/\s+/);
  // classes do Tailwind / listas de tokens
  if (words.length > 1 && words.every((w) => /^[!a-z0-9_[\]().,%#:/-]+$/.test(w)) && words.some((w) => /[-:[]/.test(w))) return false;
  if (/^\[[\w .-]+\]/.test(t)) return false; // mensagem de log "[Modulo] ..."
  if (/^[a-z]/.test(t) && words.length < 2) return false;
  if (/^[A-Z][a-zA-Z0-9]+$/.test(t) && /[a-z][A-Z]/.test(t)) return false; // PascalCase
  return true;
}

const found = new Map(); // texto -> { kind, files:Set }
function add(text, kind, file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const cur = found.get(text) ?? { kind, files: new Set() };
  cur.files.add(rel);
  found.set(text, cur);
}

function inNonTextAttr(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return NON_TEXT_ATTRS.has(p.name.getText()) || /^(data-|on[A-Z])/.test(p.name.getText());
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

function skipLiteral(node) {
  const p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true; // chave de objeto
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isCallExpression(p)) {
    const callee = p.expression.getText();
    if (/(^|\.)(require|import|querySelector(All)?|getElementById|addEventListener|removeEventListener|getAttribute|setAttribute|hasAttribute|startsWith|endsWith|includes|split|replace|test|match|getItem|setItem|removeItem|emit|on|off|invoke|send|cn|clsx|twMerge|cva)$/.test(callee)) return true;
  }
  if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText())) return true;
  if (ts.isCaseClause(p)) return true;
  return inNonTextAttr(node);
}

for (const file of SOURCES.flatMap((d) => walk(d))) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const t = decodeEntities(normalizeJsxText(node.getText()));
      if (t && /[A-Za-z]{2}/.test(t) && !/[{}]/.test(t)) add(t, "jsx", file);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!skipLiteral(node) && looksLikeUiText(node.text)) add(node.text.trim(), "literal", file);
    } else if (ts.isTemplateExpression(node)) {
      if (!skipLiteral(node)) {
        let pat = node.head.text;
        node.templateSpans.forEach((span, i) => (pat += `{${i}}` + span.literal.text));
        const staticText = pat.replace(/\{\d+\}/g, " ").trim();
        if (looksLikeUiText(staticText) && /[A-Za-z]{3}/.test(staticText) && !/\{\d+\}\{\d+\}/.test(pat)) add(pat.trim(), "pattern", file);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const dictFile = path.join(root, "apps/web/src/i18n/pt-BR.json");
const dict = existsSync(dictFile) ? JSON.parse(readFileSync(dictFile, "utf8")) : {};
const missingOnly = process.argv.includes("--missing");
const list = [...found.entries()]
  .filter(([text]) => !missingOnly || !(text in dict))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([text, v]) => ({ text, kind: v.kind, file: [...v.files][0] }));
const out = path.join(here, missingOnly ? "strings-missing.json" : "strings.json");
writeFileSync(out, JSON.stringify(list, null, 1));
const kinds = list.reduce((m, s) => ((m[s.kind] = (m[s.kind] ?? 0) + 1), m), {});
console.log(`${list.length} textos (${JSON.stringify(kinds)}) -> ${path.relative(root, out)}`);
