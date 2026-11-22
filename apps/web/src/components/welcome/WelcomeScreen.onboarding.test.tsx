import "../../test/install-local-storage-mock";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphicsEngine, TitleEngine } from "@openreel/core";
import { WelcomeScreen } from "./WelcomeScreen";
import { useProjectStore } from "../../stores/project-store";
import { useEngineStore } from "../../stores/engine-store";
import { useUIStore } from "../../stores/ui-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), track: vi.fn(), failCreate: false }));
vi.mock("../../services/project-creation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/project-creation")>();
  return {
    ...actual,
    createEditorProject: (...args: Parameters<typeof actual.createEditorProject>) =>
      mocks.failCreate ? Promise.reject(new Error("boom")) : actual.createEditorProject(...args),
  };
});
vi.mock("../../hooks/use-router", () => ({
  useRouter: () => ({ navigate: mocks.navigate }),
}));
vi.mock("../../hooks/useEditorPreload", () => ({ useEditorPreload: () => {} }));
vi.mock("../../hooks/usePhoneEditor", () => ({ usePhoneEditor: () => false }));
vi.mock("../../hooks/useAnalytics", () => ({
  useAnalytics: () => ({ track: mocks.track }),
  AnalyticsEvents: { PROJECT_CREATED: "project_created" },
}));

type OpenReelWindow = { openreel?: { platform: "desktop" } };
const win = window as unknown as OpenReelWindow;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.failCreate = false;
  win.openreel = { platform: "desktop" };
  useEngineStore.setState({ titleEngine: new TitleEngine(), graphicsEngine: new GraphicsEngine() });
  useUIStore.setState({ skipWelcomeScreen: false });
  useOnboardingStore.setState({
    status: "unseen",
    skippedBy: undefined,
    openSheet: null,
    bandOpen: false,
    formatChosenProjectId: undefined,
  });
});
afterEach(() => {
  cleanup();
  delete win.openreel;
});

describe("WelcomeScreen first-run band", () => {
  it("shows the band above the format cards without hiding or renaming them", () => {
    render(<WelcomeScreen />);
    expect(screen.getByRole("button", { name: "First time? Learn in 10 minutes" })).toBeInTheDocument();
    for (const label of ["Vertical", "Horizontal", "Square"]) {
      const button = screen.getByRole("button", { name: `Create ${label} project` });
      expect(button).toBeEnabled();
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
    // Non-modal: nothing but the screen itself is fixed-position and no dialog is open.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not render the band on the web build", () => {
    delete win.openreel;
    render(<WelcomeScreen />);
    expect(screen.queryByRole("button", { name: "First time? Learn in 10 minutes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip setup" })).toBeNull();
  });

  it("The Editor: always shows the start options, even after onboarding, with no skip control", () => {
    useOnboardingStore.setState({ status: "done" });
    render(<WelcomeScreen />);
    expect(screen.getByRole("button", { name: "First time? Learn in 10 minutes" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Skip on startup" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Skip setup/ })).toBeNull();
  });

  it("The Editor: Esc on the home screen does not jump to the editor", () => {
    render(<WelcomeScreen />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("clicking a format retires the band as 'format' and marks the format chosen", async () => {
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Create Horizontal project/ }));
    // Onboarding is retired only once the project exists.
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("editor"));
    expect(useOnboardingStore.getState()).toMatchObject({ status: "skipped", skippedBy: "format" });
    expect(useOnboardingStore.getState().formatChosenProjectId).toBe(
      useProjectStore.getState().project.id,
    );
  });

  it("keeps onboarding when project creation fails", async () => {
    mocks.failCreate = true;
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Create Horizontal project/ }));
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(useOnboardingStore.getState().status).toBe("unseen");
    expect(useOnboardingStore.getState().formatChosenProjectId).toBeUndefined();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("The Editor: ignores a stored skipWelcomeScreen and stays on the home screen", () => {
    useUIStore.setState({ skipWelcomeScreen: true });
    useOnboardingStore.setState({ status: "done" });
    render(<WelcomeScreen />);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "First time? Learn in 10 minutes" })).toBeInTheDocument();
  });
  it("The Editor: Back from templates and recent projects returns to the home screen", async () => {
    render(<WelcomeScreen />);
    for (const open of ["Browse templates", "Recent projects"]) {
      fireEvent.click(screen.getByRole("button", { name: open }));
      const back = await screen.findByRole("button", { name: "Back" });
      fireEvent.click(back);
      expect(await screen.findByRole("heading", { name: "New project" })).toBeInTheDocument();
    }
  });

  it("The Editor: every welcome view has its own window bar, so the Back button sits below the drag strip", async () => {
    render(<WelcomeScreen />);
    expect(screen.getByTestId("welcome-titlebar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse templates" }));
    const back = await screen.findByRole("button", { name: "Back" });
    const bar = screen.getByTestId("welcome-titlebar");
    // The bar comes first in the view, the header with Back after it (not inside the 44 px drag strip).
    expect(bar.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.contains(back)).toBe(false);
  });
});
