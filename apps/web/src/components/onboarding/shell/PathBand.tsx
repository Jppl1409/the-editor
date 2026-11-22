import { lazy, Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cn } from "@openreel/ui";
import { ChevronRight, GraduationCap, Keyboard, Plug, Sparkles } from "@/icons/lucide-compat";
import { useOnboardingStore } from "../../../stores/onboarding-store";
import { useOnboardingGate } from "./useOnboardingGate";

// The pro row pulls in keyboard-shortcuts and project-replacement, so it stays out of the welcome chunk
// and loads on first open of the "I already edit" tile.
const ProRowSlot = lazy(() => import("./ProRowSlot").then((m) => ({ default: m.ProRowSlot })));

/**
 * The first-run path band (spec 2.2). Eager, static JSX and CSS transitions only: no framer-motion,
 * no images, no fonts. It sits in the page flow above the format cards and never overlaps them, so
 * the "Horizontal" button stays clickable for people and for the perf and e2e harnesses.
 */

const COLLAPSE_MS = 200;

interface Tile {
  id: "ai" | "learn" | "pro";
  title: string;
  body: string;
  Icon: typeof Sparkles;
}

const TILES: Tile[] = [
  {
    id: "ai",
    title: "Edit with AI",
    body: "Describe the video you want. The AI cuts, trims and titles. Undo any step.",
    Icon: Sparkles,
  },
  {
    id: "learn",
    title: "Learn to edit",
    body: "Six short, hands-on lessons on a real project. About 10 minutes.",
    Icon: GraduationCap,
  },
  {
    id: "pro",
    title: "I already edit",
    body: "Premiere, Resolve or Final Cut? Keys, import, your layout.",
    Icon: Keyboard,
  },
];

export function PathBand() {
  const gate = useOnboardingGate();
  const status = useOnboardingStore((s) => s.status);
  // Starting a path from the band (a key chip, a tile) moves the status to "in-progress". Keep the band
  // up for the rest of this visit so the user can finish choosing; Done, Skip or a format card closes it.
  const [shownThisVisit, setShownThisVisit] = useState(gate.showBand);
  if (gate.showBand && !shownThisVisit) setShownThisVisit(true);
  const showBand = gate.showBand || (shownThisVisit && status === "in-progress");
  const [present, setPresent] = useState(showBand);
  const [open, setOpen] = useState(showBand);

  // Collapse with a short height transition, then unmount. Mounting is immediate (first paint).
  useEffect(() => {
    if (showBand) {
      setPresent(true);
      setOpen(true);
      return;
    }
    setOpen(false);
    const timer = window.setTimeout(() => setPresent(false), COLLAPSE_MS + 20);
    return () => window.clearTimeout(timer);
  }, [showBand]);

  if (!present) return null;
  return (
    <div
      data-testid="onboarding-path-band"
      data-state={open ? "open" : "closed"}
      className="grid w-full transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-opacity"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
    >
      <div
        className={open ? "min-h-0" : "min-h-0 overflow-hidden"}
        inert={!open}
        aria-hidden={!open}
      >
        <BandContent live={showBand} />
      </div>
    </div>
  );
}

function BandContent({ live: _live }: { live: boolean }) {
  const [proOpen, setProOpen] = useState(false);
  const [rover, setRover] = useState(0);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      performance.mark("openreel:onboarding-visible");
    } catch {
      // Marks are diagnostics only.
    }
  }, []);

  // The Editor: sem "Pular configuração" nem Esc para dispensar; a tela inicial sempre mostra os caminhos.

  const select = useCallback((id: Tile["id"]) => {
    const store = useOnboardingStore.getState();
    if (id === "pro") {
      store.setPersona("pro");
      setProOpen((v) => !v);
      return;
    }
    store.setPersona(id);
    store.showSheet(id);
  }, []);

  const onTileKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TILES.length - 1;
    let next = index;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setRover(next);
    tileRefs.current[next]?.focus();
  };

  return (
    <section role="group" aria-label="Choose how to start" className="w-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-fg-3">
        How do you want to start?
      </h2>
      <div className="flex flex-col gap-2" data-testid="onboarding-tiles">
        {TILES.map((tile, index) => {
          const expanded = tile.id === "pro" ? proOpen : undefined;
          const primary = tile.id === "ai";
          return (
            <button
              key={tile.id}
              ref={(el) => {
                tileRefs.current[index] = el;
              }}
              type="button"
              tabIndex={rover === index ? 0 : -1}
              aria-expanded={expanded}
              aria-controls={tile.id === "pro" ? "onboarding-pro-row" : undefined}
              onFocus={() => setRover(index)}
              onKeyDown={(e) => onTileKeyDown(e, index)}
              onClick={() => select(tile.id)}
              className={cn(
                "group relative flex w-full min-w-0 cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border px-4 py-3.5 [@media(max-height:820px)]:py-2.5 text-left outline-none",
                "transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-[#6f8cff] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                primary
                  ? "border-[#2350d6]/70 bg-[linear-gradient(135deg,rgba(0,47,167,0.55),rgba(0,47,167,0.18))] shadow-[0_10px_40px_-12px_rgba(0,47,167,0.7)] hover:border-[#6f8cff] hover:shadow-[0_14px_50px_-10px_rgba(35,80,214,0.85)]"
                  : "border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] aria-expanded:border-[#2350d6]/60 aria-expanded:bg-white/[0.06]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                  primary ? "bg-white text-[#002fa7]" : "bg-white/[0.06] text-[#8aa4ff] group-hover:bg-[#002fa7]/40 group-hover:text-white",
                )}
              >
                <tile.Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-5 text-white">{tile.title}</span>
                <span className={cn("mt-0.5 block text-[13px] leading-[18px]", primary ? "text-white/75" : "text-fg-3")}>
                  {tile.body}
                </span>
              </span>
              <ChevronRight
                size={18}
                aria-hidden
                className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none",
                  primary ? "text-white" : "text-fg-3 group-hover:text-white",
                  tile.id === "pro" && proOpen && "rotate-90",
                )}
              />
            </button>
          );
        })}
      </div>
      {proOpen && (
        <Suspense fallback={<div id="onboarding-pro-row" aria-busy="true" className="mt-2 h-10" />}>
          <ProRowSlot />
        </Suspense>
      )}
      <div className="mt-4 [@media(max-height:820px)]:mt-3 flex items-center gap-2 text-[13px] text-fg-3">
        <Plug size={14} aria-hidden className="shrink-0 text-[#8aa4ff]" />
        <span className="min-w-0">
          Using Claude Code, Cursor or another agent?{" "}
          <button
            type="button"
            onClick={() => useOnboardingStore.getState().showSheet("agent")}
            className="cursor-pointer rounded font-medium text-[#8aa4ff] outline-none underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[#6f8cff]"
          >
            Connect an agent
          </button>
        </span>
      </div>
    </section>
  );
}
