import { app, BrowserWindow, ipcMain, net, shell } from "electron";
import type { AppUpdater } from "electron-updater";
import { CHANNELS } from "../shared/ipc-contract";

// The Editor: atualizações pelos GitHub Releases do projeto. `releases/latest/download/<arquivo>`
// sempre aponta para o release mais novo, e o build publica ali o `latest.yml` (versão + instalador).
export const UPDATE_FEED_URL = "https://github.com/Jppl1409/the-editor/releases/latest/download";

type UpdaterStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "none" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  /** Mac sem certificado da Apple: não instala sozinho; o botão baixa o .dmg novo. */
  | { state: "manual"; version: string; url: string }
  | { state: "error"; message: string };

let lastStatus: UpdaterStatus | null = null;

function broadcast(status: UpdaterStatus): void {
  lastStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.updaterStatus, status);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 1.2.10 > 1.2.9; ignora sufixos (-beta). */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.split("-")[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** Lê `version:` do latest.yml publicado (o mesmo para Windows e Mac: saem do mesmo build). */
export function parseFeedVersion(yml: string): string | null {
  const match = /^version:\s*['"]?([0-9][^\s'"]*)/m.exec(yml);
  return match ? match[1] : null;
}

function runCheckWhenLoaded(win: BrowserWindow, run: () => void): void {
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", run);
  } else {
    run();
  }
}

let updaterRequested = false;

// Confere em silêncio ao abrir (só avisa; não baixa). O botão "Verificar atualizações" da tela
// inicial confere de novo e, no Windows, já baixa; "Reiniciar e atualizar" instala e reabre o app.
// Só em app instalado (no `pnpm dev` não há feed).
export function initAutoUpdater(): void {
  if (!app.isPackaged) return;
  // Chamado a cada janela mostrada; ipcMain.handle lança se registrar duas vezes.
  if (updaterRequested) return;
  updaterRequested = true;
  if (process.platform === "darwin") {
    wireManualUpdater();
    return;
  }
  // electron-updater é importado sob demanda, depois da primeira pintura (pesa no startup).
  void import("electron-updater")
    .then(({ autoUpdater }) => wireAutoUpdater(autoUpdater))
    .catch((error) => {
      updaterRequested = false;
      console.error("[updater] failed to load:", error);
    });
}

function checkOnLaunch(check: () => Promise<unknown>): void {
  const run = () => void check().catch((error) => console.error("[updater] check failed:", error));
  const [firstWindow] = BrowserWindow.getAllWindows();
  if (firstWindow) {
    runCheckWhenLoaded(firstWindow, run);
  } else {
    app.once("browser-window-created", (_event, win) => runCheckWhenLoaded(win, run));
  }
  // Uma janela que carrega depois ainda recebe o último status.
  app.on("browser-window-created", (_event, win) => {
    win.webContents.once("did-finish-load", () => {
      if (lastStatus && !win.isDestroyed()) win.webContents.send(CHANNELS.updaterStatus, lastStatus);
    });
  });
}

function wireAutoUpdater(autoUpdater: AppUpdater): void {
  autoUpdater.setFeedURL({ provider: "generic", url: UPDATE_FEED_URL });
  // Baixa só quando a pessoa pede; instala ao sair (o app passa pelo aviso de "não salvo" antes).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  let downloading = false;
  let downloaded = false;
  const download = async () => {
    if (downloading || downloaded) return;
    downloading = true;
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      broadcast({ state: "error", message: errorMessage(error) });
    } finally {
      downloading = false;
    }
  };

  // Botão: confere e, havendo versão nova, já baixa.
  ipcMain.handle(CHANNELS.updaterCheck, async () => {
    if (downloaded) {
      if (lastStatus) broadcast(lastStatus);
      return;
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.isUpdateAvailable) await download();
    } catch (error) {
      broadcast({ state: "error", message: errorMessage(error) });
    }
  });
  ipcMain.handle(CHANNELS.updaterDownload, download);
  // "Reiniciar e atualizar": sai pelo caminho normal (com o aviso de alterações não salvas). Só
  // depois que a saída foi confirmada (will-quit) o instalador roda em silêncio e reabre o app.
  ipcMain.handle(CHANNELS.updaterInstall, () => {
    app.once("will-quit", () => {
      (autoUpdater as unknown as { install(isSilent: boolean, isForceRunAfter: boolean): boolean }).install(true, true);
    });
    app.quit();
  });
  ipcMain.handle(CHANNELS.updaterOpenDownload, () => undefined);

  autoUpdater.on("checking-for-update", () => broadcast({ state: "checking" }));
  autoUpdater.on("update-available", (info) => broadcast({ state: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => broadcast({ state: "none" }));
  autoUpdater.on("download-progress", (progress) =>
    broadcast({ state: "downloading", percent: Math.round(progress.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    downloaded = true;
    broadcast({ state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", (error) => broadcast({ state: "error", message: errorMessage(error) }));

  checkOnLaunch(() => autoUpdater.checkForUpdates());
}

// Mac: o app tem só assinatura ad-hoc, e a atualização automática do macOS exige Developer ID.
// Então confere a versão no latest.yml e, havendo nova, o botão abre o download do .dmg certo.
function wireManualUpdater(): void {
  const dmgUrl = `${UPDATE_FEED_URL}/TheEditor-${process.arch === "arm64" ? "arm64" : "x64"}.dmg`;
  const check = async () => {
    broadcast({ state: "checking" });
    try {
      const response = await net.fetch(`${UPDATE_FEED_URL}/latest.yml`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const version = parseFeedVersion(await response.text());
      if (!version) throw new Error("latest.yml sem versão");
      broadcast(isNewerVersion(version, app.getVersion()) ? { state: "manual", version, url: dmgUrl } : { state: "none" });
    } catch (error) {
      broadcast({ state: "error", message: errorMessage(error) });
    }
  };
  ipcMain.handle(CHANNELS.updaterCheck, check);
  ipcMain.handle(CHANNELS.updaterDownload, () => undefined);
  ipcMain.handle(CHANNELS.updaterInstall, () => undefined);
  ipcMain.handle(CHANNELS.updaterOpenDownload, () => shell.openExternal(dmgUrl));
  checkOnLaunch(check);
}
