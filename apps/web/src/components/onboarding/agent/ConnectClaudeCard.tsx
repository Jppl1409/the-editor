// The Editor: "Conectar ao meu Claude". A IA roda no Claude Desktop de quem usa, no plano dela
// (Pro/Max/Team), sem chave de API. O app só entrega a extensão The Editor.mcpb; nunca faz login no
// Claude nem guarda credencial (regra da Anthropic para apps de terceiros).
import React, { useEffect, useState } from "react";
import { Sparkles } from "@/icons/lucide-compat";
import { cn } from "@openreel/ui";
import { toast } from "../../../stores/notification-store";
import type { OpenReelClaudeExtensionResult } from "../../../types/global";

const DOWNLOAD_URL = "https://claude.ai/download";

interface ConnectClaudeCardProps {
  className?: string;
  /** Smaller layout for dialogs. */
  compact?: boolean;
  /** Destaque da tela inicial: faixa grande em azul Klein. */
  hero?: boolean;
}

export const ConnectClaudeCard: React.FC<ConnectClaudeCardProps> = ({ className, compact, hero }) => {
  const bridge = typeof window !== "undefined" ? window.openreel?.mcp?.claudeExtension : undefined;
  const [info, setInfo] = useState<OpenReelClaudeExtensionResult | null>(null);
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    void bridge("status")
      .then((r) => alive && setInfo(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [bridge]);

  if (!bridge || (info && !info.bundleAvailable)) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const r = await bridge("prepare");
      setInfo(r);
      if (!r.filePath) {
        toast.error("Não deu para preparar a extensão", r.error ?? "Tente de novo.");
        return;
      }
      setPrepared(r.filePath);
      if (r.claudeInstalled) await bridge("openClaude");
    } catch (error) {
      toast.error("Não deu para preparar a extensão", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const claudeMissing = info !== null && !info.claudeInstalled;

  return (
    <section
      data-testid="connect-claude-card"
      className={cn(
        "text-left",
        hero
          ? "space-y-4 rounded-2xl border border-[#2350d6]/70 bg-[linear-gradient(135deg,rgba(0,47,167,0.55),rgba(0,47,167,0.16))] p-5 shadow-[0_14px_50px_-14px_rgba(0,47,167,0.75)]"
          : cn("rounded-lg border border-accent/40 bg-accent-soft", compact ? "space-y-2.5 p-3" : "space-y-3 p-4"),
        className,
      )}
    >
      <div className={cn("flex items-start", hero ? "gap-4" : "gap-3")}>
        <div
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center",
            hero ? "h-11 w-11 rounded-xl bg-white text-[#002fa7]" : "h-8 w-8 rounded-lg bg-accent text-white",
          )}
        >
          <Sparkles size={hero ? 20 : 16} aria-hidden />
        </div>
        <div className="space-y-1">
          <h3 className={cn("font-semibold", hero ? "text-[17px] text-white" : "text-sm text-fg")}>
            {hero ? "Edite pelo seu Claude" : "Usar com o seu Claude, sem chave de API"}
          </h3>
          <p className={cn("leading-relaxed", hero ? "text-[13px] text-white/75" : "text-xs text-fg-2")}>
            {hero
              ? "Instale a extensão no Claude Desktop e peça as edições do jeito que você falaria. Usa o seu plano do Claude, sem chave de API."
              : "Instale a extensão do The Editor no Claude Desktop e peça as edições por lá. O uso conta no seu plano do Claude, e você acompanha tudo na linha do tempo."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className={cn(
            "inline-flex cursor-pointer items-center font-semibold outline-none transition-colors focus-visible:ring-2 disabled:opacity-60",
            hero
              ? "h-10 rounded-xl bg-white px-4 text-sm text-[#002fa7] hover:bg-[#e5ebfa] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#002fa7]"
              : "h-8 rounded-[7px] bg-accent px-3 text-xs text-white hover:bg-accent-strong focus-visible:ring-ring",
          )}
        >
          {busy ? "Preparando…" : prepared ? "Preparar de novo" : "Conectar ao meu Claude"}
        </button>
        {claudeMissing && (
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center border font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              hero
                ? "h-10 rounded-xl border-white/25 bg-white/5 px-4 text-sm text-white hover:bg-white/10"
                : "h-8 rounded-[7px] border-border bg-bg-1 px-3 text-xs text-fg hover:bg-bg-2",
            )}
          >
            Baixar o Claude Desktop
          </a>
        )}
      </div>

      {claudeMissing && !prepared && (
        <p className="text-[11px] text-fg-2">
          Não achamos o Claude Desktop neste computador. Instale e entre com a sua conta antes de conectar.
        </p>
      )}

      {prepared && (
        <ol role="status" className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-fg">
          <li>
            O arquivo <span className="font-medium">The Editor.mcpb</span> foi salvo em{" "}
            <span className="font-mono text-[11px] text-fg-2">{prepared}</span> e a pasta já está aberta.
          </li>
          <li>
            No Claude Desktop, vá em <span className="font-medium">Configurações → Extensões</span> e arraste o arquivo
            para a janela (ou use <span className="font-medium">Configurações avançadas → Instalar extensão…</span>).
          </li>
          <li>Clique em Instalar. Feito uma vez, fica para sempre.</li>
          <li>
            Com o The Editor aberto, peça no Claude: <em>"no The Editor, importa os vídeos de Downloads, corta os
            silêncios e legenda"</em>.
          </li>
        </ol>
      )}
    </section>
  );
};

export default ConnectClaudeCard;
