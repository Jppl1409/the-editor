import { useOnboardingStore, type OnboardingSkippedBy, type OnboardingStatus } from "../../../stores/onboarding-store";

export interface OnboardingGateInput {
  desktop: boolean;
  status: OnboardingStatus;
  /** Help > "Welcome & Setup" re-opened the band. */
  bandOpen: boolean;
  /** Why onboarding was skipped; "automation" (test/agent-driven launch) keeps the band away. */
  skippedBy?: OnboardingSkippedBy;
}

export interface OnboardingGate {
  /** Onboarding exists on this build at all (desktop only). Drives the "Setup" link. */
  enabled: boolean;
  /** Render the path band. */
  showBand: boolean;
}

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && window.openreel?.platform === "desktop";
}

/**
 * Pure decision (spec 4.2, 5.2). Automation, legacy and agent cases are folded into `status` by the
 * store (automation/legacy at creation, agent by the flip), so the matrix reduces to this.
 */
export function computeOnboardingGate({ desktop, status, bandOpen, skippedBy }: OnboardingGateInput): OnboardingGate {
  if (!desktop) return { enabled: false, showBand: false };
  // The Editor: a tela inicial sempre mostra "Como você quer começar?" (pedido do produto), menos em
  // execuções automatizadas.
  const automated = status === "skipped" && skippedBy === "automation";
  return { enabled: true, showBand: !automated || bandOpen };
}

export function useOnboardingGate(): OnboardingGate {
  const status = useOnboardingStore((s) => s.status);
  const bandOpen = useOnboardingStore((s) => s.bandOpen === true);
  const skippedBy = useOnboardingStore((s) => s.skippedBy);
  return computeOnboardingGate({ desktop: isDesktopRuntime(), status, bandOpen, skippedBy });
}
