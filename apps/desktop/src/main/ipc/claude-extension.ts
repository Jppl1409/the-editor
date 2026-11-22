// The Editor: "Conectar ao meu Claude". Entrega a extensão The Editor.mcpb (gerada por
// branding/build-mcpb.mjs) para o usuário instalar no Claude Desktop DELE, assim a IA roda no plano
// do Claude de cada um, sem chave de API e sem o app tocar em login/credencial do Claude.
// O Claude Desktop no Windows não associa .mcpb a duplo clique, então o fluxo é: copiar o arquivo
// para Downloads, mostrá-lo no Explorer e abrir o Claude para o usuário arrastar/instalar.
import { app, shell } from "electron";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { handle } from "./index";
import { CHANNELS } from "../../shared/channels";

export const CLAUDE_EXTENSION_FILE = "The Editor.mcpb";
export const CLAUDE_DOWNLOAD_URL = "https://claude.ai/download";

export interface ClaudeExtensionResult {
  readonly bundleAvailable: boolean;
  readonly claudeInstalled: boolean;
  /** Where the user can find the file (Downloads copy after "prepare"). */
  readonly filePath: string | null;
  readonly error?: string;
}

function bundledPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "claude", CLAUDE_EXTENSION_FILE)
    : path.join(__dirname, "../../resources/claude", CLAUDE_EXTENSION_FILE);
}

function claudeInstalled(): boolean {
  try {
    return app.getApplicationNameForProtocol("claude://").trim().length > 0;
  } catch {
    return false;
  }
}

async function run(action: "status" | "prepare" | "openClaude"): Promise<ClaudeExtensionResult> {
  const source = bundledPath();
  const base = { bundleAvailable: existsSync(source), claudeInstalled: claudeInstalled() };
  if (action === "status") return { ...base, filePath: base.bundleAvailable ? source : null };
  if (action === "openClaude") {
    try {
      await shell.openExternal(base.claudeInstalled ? "claude://" : CLAUDE_DOWNLOAD_URL);
      return { ...base, filePath: null };
    } catch (error) {
      return { ...base, filePath: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (!base.bundleAvailable) {
    return { ...base, filePath: null, error: "O arquivo da extensão não veio nesta instalação." };
  }
  try {
    const target = path.join(app.getPath("downloads"), CLAUDE_EXTENSION_FILE);
    copyFileSync(source, target);
    shell.showItemInFolder(target);
    return { ...base, filePath: target };
  } catch (error) {
    // Sem permissão em Downloads: mostra o arquivo onde ele está instalado.
    shell.showItemInFolder(source);
    return { ...base, filePath: source, error: error instanceof Error ? error.message : String(error) };
  }
}

export function registerClaudeExtensionIpc(): void {
  handle(CHANNELS.mcpClaudeExtension, z.enum(["status", "prepare", "openClaude"]), (action) => run(action));
}
