import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@openreel/ui";
import { Check, Download, Loader2, RefreshCw, RotateCcw } from "@/icons/lucide-compat";
import type { OpenReelUpdaterStatus } from "../types/global";

// The Editor: botão da tela inicial. Um clique confere e, havendo versão nova, já baixa; depois
// "Restart to update" instala e reabre o app. No Mac (sem certificado da Apple) abre o download
// do .dmg novo. Só aparece no app instalado (desktop).
export function UpdateCheckButton({ className }: { className: string }): JSX.Element | null {
  const updater = typeof window === "undefined" ? undefined : window.openreel?.updater;
  const [status, setStatus] = useState<OpenReelUpdaterStatus | null>(null);
  // A conferência silenciosa da abertura não mostra erro (ex.: sem internet); a do clique mostra.
  const userAsked = useRef(false);
  const [upToDate, setUpToDate] = useState(false);

  useEffect(() => {
    if (!updater) return;
    return updater.onStatus((next) => {
      if (next.state === "error" && !userAsked.current) return;
      if (next.state === "none" && userAsked.current) {
        setUpToDate(true);
        window.setTimeout(() => setUpToDate(false), 4000);
      }
      setStatus(next);
    });
  }, [updater]);

  if (!updater?.check) return null;

  const check = () => {
    userAsked.current = true;
    setStatus({ state: "checking" });
    void updater.check?.();
  };

  let label = "Check for updates";
  let icon = <RefreshCw size={15} aria-hidden />;
  let onClick: (() => void) | undefined = check;
  let highlight = false;
  let title: string | undefined;

  switch (status?.state) {
    case "checking":
      label = "Checking…";
      icon = <Loader2 size={15} className="animate-spin" aria-hidden />;
      onClick = undefined;
      break;
    case "available":
      label = `Update to ${status.version}`;
      icon = <Download size={15} aria-hidden />;
      highlight = true;
      break;
    case "downloading":
      label = `Downloading update… ${status.percent}%`;
      icon = <Loader2 size={15} className="animate-spin" aria-hidden />;
      onClick = undefined;
      break;
    case "downloaded":
      label = "Restart to update";
      icon = <RotateCcw size={15} aria-hidden />;
      highlight = true;
      onClick = () => void updater.install();
      break;
    case "manual":
      label = `Download version ${status.version}`;
      icon = <Download size={15} aria-hidden />;
      highlight = true;
      onClick = () => void updater.openDownload?.();
      break;
    case "error":
      label = "Could not check. Try again";
      title = status.message;
      break;
    case "none":
      if (upToDate) {
        label = "You have the latest version";
        icon = <Check size={15} aria-hidden />;
      }
      break;
  }

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={title}
      data-update-state={status?.state ?? "idle"}
      className={
        highlight
          ? `${className} border-[#2350d6] bg-[#002fa7] text-white hover:bg-[#2350d6] hover:text-white`
          : className
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}
