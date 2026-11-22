// Gera "The Editor.mcpb": a extensão que liga o Claude Desktop (de cada usuário, no plano dele) ao app.
// O servidor dentro do pacote é o mesmo shim stdio do app (apps/desktop/dist/mcp-shim/index.js), que
// encontra o The Editor aberto por ~/.openreel/mcp-endpoint.json. Rodar depois do `tsup` do desktop.
//
//   node branding/build-mcpb.mjs
//
// Saída: apps/desktop/resources/claude/The Editor.mcpb (vai para o instalador via extraResources).
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MCPB_CLI = "@anthropic-ai/mcpb@2.1.2";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "apps", "desktop");
const shim = path.join(desktop, "dist", "mcp-shim", "index.js");
const icon = path.join(desktop, "build", "icon.png");
const stage = path.join(desktop, "build", "mcpb-stage");
const outDir = path.join(desktop, "resources", "claude");
const out = path.join(outDir, "The Editor.mcpb");

if (!existsSync(shim)) {
  console.error(`Falta ${shim}. Rode o build do desktop (pnpm exec tsup) antes.`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(path.join(desktop, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(path.join(root, "branding", "mcpb", "manifest.json"), "utf8"));
manifest.version = version;

rmSync(stage, { recursive: true, force: true });
mkdirSync(path.join(stage, "server"), { recursive: true });
writeFileSync(path.join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(icon, path.join(stage, "icon.png"));
// As mensagens do shim dizem "OpenReel"; no pacote distribuído o usuário deve ler "The Editor".
const server = readFileSync(shim, "utf8").replace(/OpenReel(?![A-Za-z_])/g, "The Editor");
writeFileSync(path.join(stage, "server", "index.js"), server);

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
run(`npx -y ${MCPB_CLI} validate "${path.join(stage, "manifest.json")}"`);
mkdirSync(outDir, { recursive: true });
rmSync(out, { force: true });
run(`npx -y ${MCPB_CLI} pack "${stage}" "${out}"`);
if (!existsSync(out)) {
  console.error("mcpb pack não gerou o arquivo.");
  process.exit(1);
}
console.log(`OK: ${out}`);
