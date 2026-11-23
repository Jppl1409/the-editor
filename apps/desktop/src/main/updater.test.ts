import { describe, expect, it, vi, beforeEach } from "vitest";

const handle = vi.fn();
const on = vi.fn();
vi.mock("electron", () => ({
  app: { isPackaged: true, on: vi.fn(), once: vi.fn(), quit: vi.fn(), getVersion: () => "1.0.1" },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle },
  net: { fetch: vi.fn() },
  shell: { openExternal: vi.fn() },
}));
const mockUpdater: Record<string, unknown> = {
  on,
  setFeedURL: vi.fn(),
  checkForUpdates: vi.fn().mockResolvedValue(undefined),
  downloadUpdate: vi.fn(),
  allowPrerelease: false,
};
vi.mock("electron-updater", () => ({ autoUpdater: mockUpdater }));

describe("initAutoUpdater", () => {
  beforeEach(() => {
    handle.mockClear();
    on.mockClear();
  });

  it("wires electron-updater exactly once however many windows are shown", async () => {
    const { initAutoUpdater } = await import("./updater");
    initAutoUpdater();
    initAutoUpdater();
    initAutoUpdater();
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // check, download, install, openDownload
    expect(handle).toHaveBeenCalledTimes(4);
    expect(on).toHaveBeenCalledTimes(6);
  });

  it("points at the project's GitHub releases and never downloads without being asked", async () => {
    const { initAutoUpdater, UPDATE_FEED_URL } = await import("./updater");
    initAutoUpdater();
    await vi.waitFor(() => expect(mockUpdater.autoDownload).toBe(false));
    expect(mockUpdater.setFeedURL).toHaveBeenCalledWith({ provider: "generic", url: UPDATE_FEED_URL });
    expect(UPDATE_FEED_URL).toBe("https://github.com/Jppl1409/the-editor/releases/latest/download");
    expect(mockUpdater.allowPrerelease).toBe(false);
  });
});

describe("version helpers", () => {
  it("compares versions numerically", async () => {
    const { isNewerVersion } = await import("./updater");
    expect(isNewerVersion("1.0.10", "1.0.9")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.0.99")).toBe(true);
    expect(isNewerVersion("1.0.1", "1.0.1")).toBe(false);
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false);
  });

  it("reads the version from latest.yml", async () => {
    const { parseFeedVersion } = await import("./updater");
    expect(parseFeedVersion("version: 1.0.2\nfiles:\n  - url: TheEditor-Setup.exe\n")).toBe("1.0.2");
    expect(parseFeedVersion("version: '2.3.4'\n")).toBe("2.3.4");
    expect(parseFeedVersion("files: []\n")).toBeNull();
  });
});
