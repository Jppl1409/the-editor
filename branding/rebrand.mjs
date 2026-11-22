// Troca a marca visível "OpenReel" por "The Editor" no app (UI web + processo
// principal do Electron). Idempotente: rode de novo depois de puxar
// atualizações do upstream (git pull) — `node branding/rebrand.mjs`.
// Não mexe em identificadores (@openreel/core, OpenReelFoo), testes, nem no
// LICENSE (a licença MIT exige manter o aviso de copyright original).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "The Editor";

const SKIP = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /rigging-backend\.ts$/, /AboutDialog\.tsx$/, /preset-caption\.ts$/, /the-editor-theme\.css$/, /updater\.ts$/, /dom-translate\.ts$/, /i18n[\\/]pt-BR\.json$/];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (/\.(tsx?|html|json|css)$/.test(entry) && !SKIP.some((re) => re.test(full))) {
      out.push(full);
    }
  }
  return out;
}

const targets = [
  ...walk(path.join(root, "apps/web/src")),
  ...walk(path.join(root, "apps/desktop/src/main")),
  path.join(root, "apps/web/index.html"),
  path.join(root, "apps/web/public/manifest.json"),
];

let files = 0;
let hits = 0;
for (const file of targets) {
  if (file.endsWith(".json") && !file.endsWith("manifest.json")) continue;
  const before = readFileSync(file, "utf8");
  let after = before
    .replace(/OpenReel Video - Professional Video Editor/g, `${NAME} — editor de vídeo com IA`)
    .replace(/\b[Tt]he OpenReel(?![A-Za-z_])/g, NAME)
    .replace(/OpenReel(?![A-Za-z_])/g, NAME);
  if (after !== before) {
    hits += (before.match(/OpenReel(?![A-Za-z_])/g) || []).length;
    files++;
    writeFileSync(file, after);
  }
}
console.log(`rebrand: ${hits} ocorrências em ${files} arquivos`);

// ---- Tela inicial e página de compartilhamento: logo + nome ----
{
  const welcome = path.join(root, "apps/web/src/components/welcome/WelcomeScreen.tsx");
  let w = readFileSync(welcome, "utf8");
  w = w
    .replace(
      /(\r?\n)const OpenReelLogo: React\.FC<\{ className\?: string \}> = \(\{ className = "" \}\) => \(\r?\n  <svg[\s\S]*?<\/svg>\r?\n\);\r?\n/,
      "$1",
    )
    .replace(
      /<OpenReelLogo className="w-full h-full" \/>/,
      '<img src={`${import.meta.env.BASE_URL}icons/editor-reel.svg`} alt="" className="w-full h-full" />',
    )
    .replace(/(\s*)Open Reel Video(\s*<\/span>)/, "$1The Editor$2");
  writeFileSync(welcome, w);
  const share = path.join(root, "apps/web/src/pages/SharePage.tsx");
  writeFileSync(share, readFileSync(share, "utf8").replace(">Open Reel Video<", ">The Editor<"));
}

// ---- Cores: verde-esmeralda de MARCA do OpenReel -> Azul Klein. ----
// Não toca nos verdes com significado (status ✓, canal G das curvas, tela verde,
// classes Tailwind green-*). A paleta principal fica em apps/web/src/the-editor-theme.css.
const COLOR_MAP = [
  [/#2bd49a/gi, "#3a63e0"], // acento (escuro)
  [/#16b88a/gi, "#002fa7"], // acento forte
  [/#10b981/gi, "#002fa7"], // acento (claro)
  [/#062a1d/gi, "#ffffff"], // texto sobre o acento
  [/#1e2a25/gi, "#0f2466"], // acento suave / selecionado (escuro)
  // Roxo da "cor da IA" do OpenReel (chat, Connect your AI) → família Klein.
  [/#8c6eff/gi, "#2350d6"], // acento da IA
  [/#2d2545/gi, "#0f2466"], // fundo suave da IA
  [/#c9b8ff/gi, "#a9bdf5"], // texto sobre o fundo suave
  [/#dcd0ff/gi, "#c9d6fa"], // texto sobre o fundo suave (mobile)
];
const RGBA_FILES = [/WelcomeScreen\.tsx$/, /SpotlightTour\.tsx$/];
let colorFiles = 0;
for (const file of walk(path.join(root, "apps/web/src"))) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [re, to] of COLOR_MAP) after = after.replace(re, to);
  if (RGBA_FILES.some((re) => re.test(file))) {
    after = after.replace(/rgba\(34, ?197, ?94/g, "rgba(0,47,167").replace(/emerald-(\d)/g, "blue-$1");
  }
  if (after !== before) {
    writeFileSync(file, after);
    colorFiles++;
  }
}
console.log(`cores: ${colorFiles} arquivos com verde de marca -> Azul Klein`);
