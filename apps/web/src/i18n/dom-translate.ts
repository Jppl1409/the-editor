// The Editor: interface em português (padrão) sem reescrever as 367 telas do OpenReel.
// O código continua em inglês (o fork segue recebendo updates); este módulo troca o texto na hora de
// mostrar, usando o dicionário pt-BR.json (gerado por branding/i18n/). Cobre textos, title, placeholder,
// aria-label, alt, o título da janela e confirm/alert. Textos com variáveis usam padrões "{0} clipes".
// Marque um elemento com data-no-translate para ele e os filhos ficarem como estão.
import dict from "./pt-BR.json";

export type Language = "pt-BR" | "en";
const STORAGE_KEY = "the-editor-lang";
const ATTRS = ["title", "placeholder", "aria-label", "alt", "aria-description", "aria-roledescription"] as const;
// Texto que o usuário digita/edita nunca é traduzido; atributos (placeholder etc.) de inputs são.
const ATTR_SKIP = "[data-no-translate], code, pre";
const TEXT_SKIP = `${ATTR_SKIP}, script, style, textarea, [contenteditable=''], [contenteditable='true']`;

export function getLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "pt-BR";
  } catch {
    return "pt-BR";
  }
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // sem storage: segue no padrão
  }
  // Voltar ao inglês exige o texto original que o React montou; recarregar é o jeito seguro.
  window.location.reload();
}

interface Pattern {
  readonly re: RegExp;
  readonly out: string;
  /** Padrão com pouco texto fixo ("Add {0}") só aceita variável curta, senão engole frases inteiras. */
  readonly maxWords: number;
}

const exact = new Map<string, string>();
const patterns: Pattern[] = [];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(key: string, value: string): Pattern {
  const parts = key.split(/\{(\d+)\}/);
  let src = "^";
  const order: number[] = [];
  parts.forEach((part, i) => {
    if (i % 2 === 0) src += escapeRe(part);
    else {
      order.push(Number(part));
      src += "([\\s\\S]*?)"; // pode ser vazio: o "s" do plural some no singular
    }
  });
  // {n} no valor -> grupo da regex correspondente
  const out = value.replace(/\{(\d+)\}/g, (_m, n) => `\u0000${order.indexOf(Number(n)) + 1}\u0000`);
  const fixedLetters = (key.replace(/\{\d+\}/g, "").match(/[A-Za-z]/g) ?? []).length;
  return { re: new RegExp(`${src}$`), out, maxWords: fixedLetters < 10 ? 3 : Infinity };
}

let loaded = false;
function load(): void {
  if (loaded) return;
  loaded = true;
  const entries = Object.entries(dict as Record<string, string>);
  const withVars: Array<[string, string]> = [];
  for (const [k, v] of entries) {
    if (!v || k === v) continue;
    if (/\{\d+\}/.test(k)) {
      // Padrão genérico demais ("{0}: {1}") pegaria qualquer texto.
      if ((k.replace(/\{\d+\}/g, "").match(/[A-Za-z]/g) ?? []).length >= 3) withVars.push([k, v]);
    }
    else exact.set(k, v);
  }
  // Mais texto fixo primeiro: o padrão mais específico ganha.
  withVars
    .sort((a, b) => b[0].replace(/\{\d+\}/g, "").length - a[0].replace(/\{\d+\}/g, "").length)
    .forEach(([k, v]) => patterns.push(compile(k, v)));
}

const cache = new Map<string, string | null>();

/** Tradução de um texto inteiro (ou null se não houver). Mantém espaços das pontas. */
export function translateText(input: string): string | null {
  if (!/[A-Za-z]{2}/.test(input)) return null;
  const hit = cache.get(input);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(input)!;
  const [, lead, core, trail] = m;
  let result: string | null = null;
  const direct = exact.get(core);
  if (direct !== undefined) result = lead + direct + trail;
  else {
    for (const p of patterns) {
      const g = p.re.exec(core);
      if (!g) continue;
      if (p.maxWords !== Infinity && g.slice(1).some((v) => v.trim().split(/\s+/).length > p.maxWords)) continue;
      result =
        lead + p.out.replace(/\u0000(\d+)\u0000/g, (_m, i) => {
          const v = g[Number(i)] ?? "";
          return exact.get(v) ?? v;
        }) + trail;
      break;
    }
  }
  if (cache.size > 20000) cache.clear();
  cache.set(input, result);
  return result;
}

const written = new WeakMap<Node, string>();

function skipped(el: Element | null, selector: string): boolean {
  return !!el && el.closest(selector) !== null;
}

function translateTextNode(node: Text): void {
  const data = node.data;
  if (written.get(node) === data) return;
  if (skipped(node.parentElement, TEXT_SKIP)) return;
  const t = translateText(data);
  if (t !== null && t !== data) {
    written.set(node, t);
    node.data = t;
  }
}

function translateAttr(el: Element, name: string): void {
  const value = el.getAttribute(name);
  if (!value || skipped(el, ATTR_SKIP)) return;
  const t = translateText(value);
  if (t !== null && t !== value) el.setAttribute(name, t);
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    for (const a of ATTRS) if (el.hasAttribute(a)) translateAttr(el, a);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n as Text);
    else {
      const el = n as Element;
      for (const a of ATTRS) if (el.hasAttribute(a)) translateAttr(el, a);
    }
  }
}

function patchDialogs(): void {
  const t = (message?: unknown): string | undefined =>
    typeof message === "string" ? (translateText(message) ?? message) : (message as string | undefined);
  const { alert, confirm, prompt } = window;
  window.alert = (message?: unknown) => alert.call(window, t(message));
  window.confirm = (message?: string) => confirm.call(window, t(message));
  window.prompt = (message?: string, value?: string) => prompt.call(window, t(message), value);
}

let started = false;

/** Liga a tradução (padrão: português). Chamar uma vez, antes de montar o React. */
export function startTranslation(): void {
  if (typeof document === "undefined") return;
  if (getLanguage() !== "pt-BR") {
    document.documentElement.lang = "en";
    return;
  }
  if (started) return;
  started = true;
  load();
  document.documentElement.lang = "pt-BR";
  patchDialogs();
  translateTree(document.documentElement);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") translateTextNode(r.target as Text);
      else if (r.type === "attributes") translateAttr(r.target as Element, r.attributeName!);
      else r.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
}
