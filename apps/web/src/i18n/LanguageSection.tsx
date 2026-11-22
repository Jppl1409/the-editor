// The Editor: escolha de idioma em Settings → General. Fica fora da tradução (data-no-translate)
// para os dois nomes aparecerem sempre iguais.
import { getLanguage, setLanguage, type Language } from "./dom-translate";

const OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
];

export function LanguageSection(): JSX.Element {
  const current = getLanguage();
  return (
    <section data-no-translate className="space-y-3" aria-labelledby="language-settings-heading">
      <div>
        <h3 id="language-settings-heading" className="text-sm font-medium">
          {current === "pt-BR" ? "Idioma" : "Language"}
        </h3>
        <p className="mt-1 text-xs leading-5 text-fg-2">
          {current === "pt-BR" ? "O app reinicia a tela ao trocar." : "The window reloads when you switch."}
        </p>
      </div>
      <div role="radiogroup" aria-label="Idioma / Language" className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={current === o.value}
            onClick={() => current !== o.value && setLanguage(o.value)}
            className={
              "h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring " +
              (current === o.value ? "border-accent bg-accent-soft text-fg" : "border-border bg-bg-2 text-fg-2 hover:text-fg")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
