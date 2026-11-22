import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import {
  Clock,
  Layers,
  ArrowRight,
  Smartphone,
  Monitor,
  Square,
  FolderOpen,
  Play,
  Sparkles,
  GraduationCap,
  Plug,
} from "@/icons/lucide-compat";
import { Button } from "@openreel/ui";
import { cn } from "@openreel/ui";

import { useProjectStore } from "../../stores/project-store";
import { createEditorProject } from "../../services/project-creation";
import { SOCIAL_MEDIA_PRESETS, type SocialMediaCategory } from "@openreel/core";
import { useRouter } from "../../hooks/use-router";
import { useEditorPreload } from "../../hooks/useEditorPreload";
import { useAnalytics, AnalyticsEvents } from "../../hooks/useAnalytics";
import { usePhoneEditor } from "../../hooks/usePhoneEditor";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { ConnectClaudeCard } from "../onboarding/agent/ConnectClaudeCard";
import { isDesktopRuntime } from "../onboarding/shell/useOnboardingGate";
import { WindowControls } from "../../desktop/shell/WindowControls";
import { withUserProjectCreation } from "../onboarding/shell/project-intent";

const MobileProjectHome = lazy(() =>
  import("./MobileProjectHome").then((module) => ({
    default: module.MobileProjectHome,
  })),
);

const TemplateGallery = lazy(() =>
  import("./TemplateGallery").then((module) => ({
    default: module.TemplateGallery,
  })),
);
const RecentProjects = lazy(() =>
  import("./RecentProjects").then((module) => ({
    default: module.RecentProjects,
  })),
);

// The Editor: a faixa de arrastar a janela (DesktopApp, 44 px no topo) continua valendo para o Electron mesmo
// com esta tela por cima — clique ali vira "arrastar janela" e o botão embaixo não recebe. Por isso cada
// tela daqui tem a própria barra: arrasta a janela, mostra minimizar/maximizar/fechar, e o conteúdo começa
// abaixo dela (ou usa no-drag).
const NO_DRAG = { WebkitAppRegion: "no-drag" } as React.CSSProperties;
function WelcomeTitleBar({ overlay = false }: { overlay?: boolean }) {
  if (!isDesktopRuntime()) return null;
  const platform =
    typeof navigator === "undefined"
      ? "linux"
      : /Mac/i.test(navigator.platform)
        ? "darwin"
        : /Win/i.test(navigator.platform)
          ? "win32"
          : "linux";
  return (
    <div
      data-testid="welcome-titlebar"
      className={cn(
        "flex h-11 shrink-0 items-center justify-end",
        overlay && "absolute inset-x-0 top-0 z-20",
      )}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <WindowControls platform={platform} />
    </div>
  );
}

const LoadingView = () => (
  <div role="status" className="p-6 text-center text-text-secondary">
    Loading…
  </div>
);

interface FormatOption {
  id: string;
  preset: SocialMediaCategory;
  label: string;
  description: string;
  dimensions: string;
  icon: React.ElementType;
  /** Tamanho da miniatura no formato real (9:16, 16:9, 1:1). */
  frame: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "vertical",
    preset: "tiktok",
    label: "Vertical",
    description: "TikTok, Reels, Shorts",
    dimensions: "1080 × 1920",
    icon: Smartphone,
    frame: "h-[104px] w-[59px]",
  },
  {
    id: "horizontal",
    preset: "youtube-video",
    label: "Horizontal",
    description: "YouTube, Vimeo, Web",
    dimensions: "1920 × 1080",
    icon: Monitor,
    frame: "h-[68px] w-[120px]",
  },
  {
    id: "square",
    preset: "instagram-post",
    label: "Square",
    description: "Instagram, Facebook",
    dimensions: "1080 × 1080",
    icon: Square,
    frame: "h-[84px] w-[84px]",
  },
];


type ViewMode = "home" | "templates" | "recent";

interface WelcomeScreenProps {
  initialTab?: "templates" | "recent";
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ initialTab }) => {
  const phone = usePhoneEditor();
  const { navigate } = useRouter();
  const { track } = useAnalytics();
  // Any other deliberate choice on the welcome screen retires the first-run band.
  const dismissBand = useCallback(() => {
    if (isDesktopRuntime()) useOnboardingStore.getState().skip("user");
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>(initialTab ?? "home");
  const [creating, setCreating] = useState(false),
    [creationError, setCreationError] = useState<string | null>(null);
  const creation = useRef<AbortController | null>(null);
  useEffect(() => () => creation.current?.abort(), []);

  useEditorPreload(true);

  const handleCreateProject = useCallback(
    async (option: FormatOption) => {
      if (creation.current) return;
      const controller = new AbortController();
      creation.current = controller;
      setCreating(true);
      setCreationError(null);
      const preset = SOCIAL_MEDIA_PRESETS[option.preset];
      try {
        const created = await withUserProjectCreation(() =>
          createEditorProject({
            name: `New ${option.label} Video`,
            settings: {
              width: preset.width,
              height: preset.height,
              frameRate: preset.frameRate,
            },
            signal: controller.signal,
          }),
        );
        if (useProjectStore.getState().project.id !== created.id) return;
        // The format is already chosen: keep EmptyProjectStart from asking again (spec 3.4).
        // Choosing a format is the strongest "I know what I want" signal: retire the band, but only now
        // that a project exists (a failed or aborted creation keeps onboarding).
        if (isDesktopRuntime()) {
          const onboarding = useOnboardingStore.getState();
          onboarding.skip("format");
          onboarding.markFormatChosen(created.id);
        }
        track(AnalyticsEvents.PROJECT_CREATED, {
          preset: option.preset,
          width: preset.width,
          height: preset.height,
          frameRate: preset.frameRate ?? 30,
          source: "quick_start",
        });
        navigate("editor");
      } catch (reason) {
        if (!controller.signal.aborted)
          setCreationError(
            reason instanceof Error
              ? reason.message
              : "Could not create project. Try again.",
          );
      } finally {
        if (creation.current === controller) creation.current = null;
        if (!controller.signal.aborted) setCreating(false);
      }
    },
    [navigate, track],
  );

  const handleTemplateApplied = useCallback(() => {
    navigate("editor");
  }, [navigate]);

  const handleProjectSelected = useCallback(() => {
    navigate("editor");
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        phone ||
        e.defaultPrevented ||
        (e.target instanceof Element &&
          e.target.closest(
            "input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]",
          ))
      )
        return;
      // The Editor: Esc só volta de Modelos/Projetos recentes; a tela inicial não é "pulável".
      if (e.key === "Escape" && viewMode !== "home") setViewMode("home");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, viewMode, phone]);

  if (phone)
    return (
      <Suspense fallback={<LoadingView />}>
        <MobileProjectHome initialTab={initialTab} />
      </Suspense>
    );

  if (viewMode === "templates") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <WelcomeTitleBar />
        <header className="flex items-center justify-between px-6 py-4 border-b border-border" style={NO_DRAG}>
          <Button
            onClick={() => setViewMode("home")}
            type="button"
            aria-label="Back"
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[7px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-7 px-2.5 text-[12px] bg-transparent text-fg-2 hover:bg-bg-2 hover:text-fg"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {<ArrowRight className="rotate-180" size={16} aria-hidden />}
            </span>
            <span className="truncate">{"Back"}</span>
          </Button>
          <span className="font-medium text-sm text-text-primary">
            Templates
          </span>
          <div className="w-16" />
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<LoadingView />}>
            <TemplateGallery onTemplateApplied={handleTemplateApplied} />
          </Suspense>
        </div>
      </div>
    );
  }

  if (viewMode === "recent") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <WelcomeTitleBar />
        <header className="flex items-center justify-between px-6 py-4 border-b border-border" style={NO_DRAG}>
          <Button
            onClick={() => setViewMode("home")}
            type="button"
            aria-label="Back"
            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[7px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-7 px-2.5 text-[12px] bg-transparent text-fg-2 hover:bg-bg-2 hover:text-fg"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {<ArrowRight className="rotate-180" size={16} aria-hidden />}
            </span>
            <span className="truncate">{"Back"}</span>
          </Button>
          <span className="font-medium text-sm text-text-primary">
            Recent Projects
          </span>
          <div className="w-16" />
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<LoadingView />}>
            <RecentProjects onProjectSelected={handleProjectSelected} />
          </Suspense>
        </div>
      </div>
    );
  }

  const navButton =
    "inline-flex h-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] font-medium text-fg-2 outline-none transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-[#6f8cff] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#050505]">
      <WelcomeTitleBar overlay />
      {/* Fundo: brilho Klein + grade sutil, só decoração */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-56 h-[640px] w-[640px] rounded-full bg-[#002fa7] opacity-40 blur-[140px]" />
        <div className="absolute -bottom-64 -right-40 h-[520px] w-[520px] rounded-full bg-[#002fa7] opacity-20 blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      </div>

      <div data-testid="welcome-scroller" className="relative h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 lg:px-10">
          <header className="flex shrink-0 items-center justify-between gap-4 pb-6 pt-12 [@media(max-height:820px)]:pb-3 [@media(max-height:820px)]:pt-11" style={NO_DRAG}>
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}icons/editor-reel.svg`} alt="" className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-tight text-white">The Editor</span>
            </div>
            <nav aria-label="Start options" className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  dismissBand();
                  setViewMode("templates");
                }}
                type="button"
                aria-label="Browse templates"
                disabled={creating}
                className={navButton}
              >
                <Layers size={15} aria-hidden />
                <span className="truncate">Browse templates</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  dismissBand();
                  setViewMode("recent");
                }}
                type="button"
                aria-label="Recent projects"
                disabled={creating}
                className={navButton}
              >
                <Clock size={15} aria-hidden />
                <span className="truncate">Recent projects</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  dismissBand();
                  navigate("editor");
                }}
                type="button"
                aria-label="Open editor"
                disabled={creating}
                className={navButton}
              >
                <FolderOpen size={15} aria-hidden />
                <span className="truncate">Open editor</span>
              </Button>
            </nav>
          </header>

          <main className="grid flex-1 grid-cols-1 items-center gap-10 py-6 [@media(max-height:820px)]:py-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
            <section className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#2350d6]/50 bg-[#002fa7]/20 px-3 py-1 text-xs font-medium text-[#aebfff]">
                <Sparkles size={13} aria-hidden />
                AI video editor · on your computer
              </span>
              <h1 className="mt-5 [@media(max-height:820px)]:mt-3 [@media(max-height:820px)]:text-[44px] bg-gradient-to-br from-white via-white to-[#8aa4ff] bg-clip-text text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-transparent xl:text-6xl">
                From idea to export.
              </h1>
              <p className="mt-4 [@media(max-height:820px)]:mt-3 max-w-lg text-base leading-relaxed text-fg-2">
                Describe the video you want and the AI cuts, captions and assembles it. Or edit everything by hand, frame by frame.
              </p>
              {/* The Editor: em vez dos 3 caminhos, o destaque é usar a IA pelo Claude da pessoa. */}
              {isDesktopRuntime() && (
                <div className="mt-8 max-w-lg space-y-4 [@media(max-height:820px)]:mt-5">
                  <ConnectClaudeCard hero />
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                    <button
                      type="button"
                      onClick={() => useOnboardingStore.getState().showSheet("lessons")}
                      className="inline-flex cursor-pointer items-center gap-2 rounded text-fg-3 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#6f8cff]"
                    >
                      <GraduationCap size={15} aria-hidden className="text-[#8aa4ff]" />
                      First time? Learn in 10 minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => useOnboardingStore.getState().showSheet("agent")}
                      className="inline-flex cursor-pointer items-center gap-2 rounded text-fg-3 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#6f8cff]"
                    >
                      <Plug size={15} aria-hidden className="text-[#8aa4ff]" />
                      Using Claude Code or Cursor?
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section
              aria-labelledby="welcome-new-project"
              className="min-w-0 rounded-3xl border border-white/[0.08] bg-[#0b0b0d]/80 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm"
            >
              <div className="mb-5">
                <h2 id="welcome-new-project" className="text-lg font-semibold tracking-tight text-white">
                  New project
                </h2>
                <p className="mt-1 text-[13px] text-fg-3">Pick a format. You can change it later.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map((option) => (
                  <Button
                    variant="ghost"
                    key={option.id}
                    onClick={() => handleCreateProject(option)}
                    type="button"
                    aria-label={`Create ${option.label} project`}
                    disabled={creating}
                    className={cn(
                      "group relative flex h-auto min-w-0 cursor-pointer flex-col items-center whitespace-normal rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 pb-4 pt-3 text-center outline-none",
                      "transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none",
                      "hover:border-[#2350d6] hover:bg-[#002fa7]/[0.12] hover:shadow-[0_12px_40px_-14px_rgba(35,80,214,0.8)]",
                      "focus-visible:ring-2 focus-visible:ring-[#6f8cff] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <span aria-hidden className="flex h-[116px] w-full items-center justify-center">
                      <span
                        className={cn(
                          "relative flex items-center justify-center rounded-lg border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))] transition-[border-color,background-color,transform] duration-300 group-hover:scale-[1.04] group-hover:border-[#6f8cff] group-hover:bg-[linear-gradient(160deg,rgba(35,80,214,0.55),rgba(0,47,167,0.15))] motion-reduce:transition-none",
                          option.frame,
                        )}
                      >
                        <Play size={16} className="fill-white/70 text-white/70 transition-colors group-hover:fill-white group-hover:text-white" />
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold text-white">{option.label}</span>
                    <span className="mt-0.5 text-xs text-fg-3">{option.description}</span>
                    <span className="mt-2.5 rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-fg-3 transition-colors group-hover:text-[#aebfff]">
                      {option.dimensions}
                    </span>
                  </Button>
                ))}
              </div>
              {creating && (
                <p role="status" className="mt-4 text-center text-xs text-fg-3">
                  Saving current work and creating project...
                </p>
              )}
              {creationError && (
                <p role="alert" className="mt-4 text-center text-xs text-red-400">
                  {creationError}
                </p>
              )}
            </section>
          </main>

          <footer className="shrink-0 py-5 [@media(max-height:820px)]:py-1.5 text-center text-xs text-fg-3/80">
            Everything runs on your computer. Your files never leave it.
          </footer>
        </div>
      </div>
    </div>
  );
};
