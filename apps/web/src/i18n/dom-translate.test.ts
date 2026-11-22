import { describe, expect, it, vi, beforeAll } from "vitest";

vi.mock("./pt-BR.json", () => ({
  default: {
    Export: "Exportar",
    "{0} tasks failed": "{0} tarefas falharam",
    "Delete {0}": "Excluir {0}",
    "Move {0} to {1}": "Mover para {1}: {0}",
    "{0} selected clip{1}": "{0} clipe{1} selecionado{1}",
    "{0}: {1}": "{1}: {0}",
    clip: "clipe",
    "Add track": "Adicionar faixa",
    "Search media": "Buscar mídia",
  },
}));

const { translateText, startTranslation } = await import("./dom-translate");

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("dom-translate", () => {
  beforeAll(() => {
    localStorage.removeItem("the-editor-lang");
    document.body.innerHTML = `
      <button id="b">Export</button>
      <span id="ws">  Add track  </span>
      <input id="i" placeholder="Search media" value="Export" />
      <div data-no-translate><span id="keep">Export</span></div>
      <code id="code">Export</code>`;
    startTranslation();
  });

  it("translates exact text and keeps the surrounding spaces", () => {
    expect(translateText("Export")).toBe("Exportar");
    expect(translateText("  Add track ")).toBe("  Adicionar faixa ");
    expect(translateText("Unknown words")).toBeNull();
    expect(translateText("00:00:01:05")).toBeNull();
  });

  it("fills patterns, translating captured words and reordering", () => {
    expect(translateText("7 tasks failed")).toBe("7 tarefas falharam");
    expect(translateText("Delete clip")).toBe("Excluir clipe");
    expect(translateText("Move A to B")).toBe("Mover para B: A");
    expect(translateText("3 selected clips")).toBe("3 clipes selecionados");
    expect(translateText("1 selected clip")).toBe("1 clipe selecionado");
    // padrão curto não engole frase inteira
    expect(translateText("Delete the whole selection now please")).toBeNull();
    // padrão genérico demais é ignorado
    expect(translateText("Foo: bar")).toBeNull();
  });

  it("translates the page on start, but not inputs' values or opted-out parts", () => {
    expect(document.getElementById("b")!.textContent).toBe("Exportar");
    expect(document.getElementById("ws")!.textContent).toBe("  Adicionar faixa  ");
    const input = document.getElementById("i") as HTMLInputElement;
    expect(input.placeholder).toBe("Buscar mídia");
    expect(input.value).toBe("Export");
    expect(document.getElementById("keep")!.textContent).toBe("Export");
    expect(document.getElementById("code")!.textContent).toBe("Export");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("follows later changes: new nodes, text updates and attributes", async () => {
    const el = document.createElement("p");
    el.textContent = "3 tasks failed";
    el.title = "Export";
    document.body.appendChild(el);
    await flush();
    expect(el.textContent).toBe("3 tarefas falharam");
    expect(el.title).toBe("Exportar");

    (el.firstChild as Text).data = "Delete clip";
    el.setAttribute("aria-label", "Add track");
    await flush();
    expect(el.textContent).toBe("Excluir clipe");
    expect(el.getAttribute("aria-label")).toBe("Adicionar faixa");
  });
});
