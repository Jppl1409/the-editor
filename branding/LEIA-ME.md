# The Editor

Editor de vídeo estilo CapCut com IA, para Windows. Base: [OpenReel Video](https://github.com/Augani/openreel-video)
(licença MIT, © Augustus Otu e colaboradores; o `LICENSE` original fica mantido na raiz).

## Usar

- Atalho **The Editor** na área de trabalho (instalado em `%LOCALAPPDATA%\Programs\TheEditor`).
- **Manual**: timeline, cortes, texto, efeitos, cor, áudio, exportação.
- **AI assist**: o chat à esquerda executa o que você escrever ("corta os silêncios", "legenda em PT",
  "versão 9:16 com título no começo"). Tem 453 ferramentas, cada pedido vira um passo que dá para desfazer.
  Precisa de uma chave de API: **Connect a model** → Anthropic → cole a chave → marque
  **Remember on this device** (guarda criptografada pelo Windows; sem isso some ao fechar o app).
- **IA pela sua assinatura do Claude (sem chave de API)** — JÁ CONFIGURADO: o servidor MCP `the-editor`
  está registrado no Claude Code (`~/.claude.json`, escopo do usuário; backup em `~/.claude.json.bak-theeditor`).
  Com o The Editor aberto, abra uma sessão nova do Claude Code e peça: "no The Editor, importa X, corta
  os silêncios, legenda e exporta". O Claude usa as 453 ferramentas do app e você vê tudo na timeline.
  Pastas que a IA pode ler/gravar: Vídeos, Música, Imagens, Documentos, Downloads, Área de trabalho
  (mudar em Settings → MCP → Allowed folders). Diagnóstico:
  `node "%LOCALAPPDATA%\Programs\TheEditor\resources\app.asar.unpacked\dist\mcp-shim\index.js" --doctor`

## Para quem instalar o app: IA pelo próprio Claude (sem chave)

Cada pessoa usa o **plano do Claude dela** (Pro, Max, Team) pelo Claude Desktop oficial. O The Editor
nunca faz login no Claude nem guarda credencial: a Anthropic proíbe apps de terceiros de oferecer login do
Claude.ai ou usar a assinatura dos usuários por dentro do app; o permitido é o usuário usar o app oficial
com o The Editor ligado como extensão.

1. Instalar o The Editor e o [Claude Desktop](https://claude.ai/download) (entrar com a própria conta).
2. No The Editor: **Connect your AI** (no chat) ou **Settings → MCP** → **Conectar ao meu Claude**. O app
   copia `The Editor.mcpb` para Downloads, mostra o arquivo e abre o Claude.
3. No Claude Desktop: **Configurações → Extensões** → arrastar o arquivo (ou *Configurações avançadas →
   Instalar extensão…*) → Instalar. Uma vez só.
4. Com o The Editor aberto, pedir no Claude: "no The Editor, importa…, corta…, legenda…, exporta…".

No Windows o duplo clique no `.mcpb` **não** abre o Claude (o Claude Desktop da loja não registra essa
extensão de arquivo), por isso o fluxo é arrastar. O arquivo também pode ser mandado avulso (WhatsApp,
site): fica em `apps\desktop\resources\claude\The Editor.mcpb` depois do build. Gerar só ele:
`node branding\build-mcpb.mjs` (precisa do `tsup` do desktop rodado antes). Quem usa Claude Code pode usar
o comando da aba "Claude Code" em Settings → MCP.

## Gerar um novo instalador

```powershell
.\branding\build-windows.ps1
```

Saída: `apps\desktop\release\TheEditor-Setup-<versão>.exe`.

## Atualizar com o projeto original

```powershell
git pull
pnpm install
.\branding\build-windows.ps1   # já reaplica a marca (rebrand.mjs) e os ícones (make_icons.py)
```

## Idioma (português por padrão)

O OpenReel não tem sistema de idiomas: os ~8 mil textos estão em inglês dentro do código. Para não
reescrever 367 telas (e continuar recebendo updates), a tradução é feita na hora de mostrar:
`apps/web/src/i18n/dom-translate.ts` troca textos, `title`, `placeholder`, `aria-label`, o título da janela
e `confirm/alert` usando o dicionário `apps/web/src/i18n/pt-BR.json` (~7,3 mil entradas, inclusive padrões
com variáveis como `{0} clipe{1} selecionado{1}`). Ligado em `main.tsx`. Inglês: Settings → General → Idioma.
Algo que não deve ser traduzido: marcar o elemento com `data-no-translate`.

Depois de um `git pull` do upstream, completar o dicionário:

```powershell
node branding\i18n\extract-strings.mjs --missing   # lista o que falta em branding\i18n\strings-missing.json
# traduzir (glossário em branding\i18n\GLOSSARIO.md) para branding\i18n\chunks\out-*.json
node branding\i18n\merge.mjs                       # valida e junta no pt-BR.json
```

Texto desenhado em canvas (régua da linha do tempo, por exemplo) não passa pelo tradutor.

## Cores

Preto + Azul Klein (#002FA7) + branco. Tudo em **um arquivo**: `apps/web/src/the-editor-theme.css`
(modo escuro = padrão, preto; modo claro = brancos + Klein, opcional nas configurações).
Os verdes de marca que estavam fixos no código são trocados pelo `rebrand.mjs`; verdes com significado
(✓ concluído, canal G das curvas, tela verde) ficam verdes de propósito.

## O que foi mudado em relação ao OpenReel

- `branding/make_icons.py`: ícone (play cortado + brilho de IA, P&B) em todos os tamanhos.
- `branding/rebrand.mjs`: troca "OpenReel" por "The Editor" nos textos visíveis.
- `apps/desktop/electron-builder.yml`: nome, appId, instalador NSIS com atalho, sem feed de update.
- `apps/desktop/src/main/updater.ts`: auto-update desligado (o feed original trocaria o app pelo OpenReel).
- Tela inicial e "Sobre": logo e créditos.
- "Conectar ao meu Claude": `branding/mcpb/manifest.json` + `branding/build-mcpb.mjs` (gera o `.mcpb` a partir
  do shim MCP), `apps/desktop/src/main/ipc/claude-extension.ts` (canal `mcpClaudeExtension`),
  `apps/web/src/components/onboarding/agent/ConnectClaudeCard.tsx` (cartão no Connect your AI, no painel de
  agentes e em Settings → MCP) e `extraResources` → `claude/` no electron-builder.
- Tela inicial redesenhada (`components/welcome/WelcomeScreen.tsx`): hero à esquerda com a faixa "Edite pelo
  seu Claude" (`ConnectClaudeCard hero`) + links "Primeira vez? Aprenda em 10 minutos" (abre as lições) e "Usa o
  Claude Code ou o Cursor?"; "Novo projeto" à direita com os formatos desenhados na proporção real. Os 3 cartões
  antigos (Editar com IA / Aprender / Eu já edito, `PathBand`) saíram da tela — o arquivo segue no código. Sem "Pular configuração", sem "Pular na inicialização" e sem
  Esc → editor: o app SEMPRE abre nela (`useOnboardingGate.ts`, `App.tsx`). Cabe em 1024×700 sem rolagem.
- Abertura animada (~1,4 s) em `apps/web/index.html` (bloco `#te-splash`): quadrado Klein entra, o play
  desliza, o corte diagonal atravessa o play, o brilho gira e "The Editor" aparece; some quando a animação
  terminou E o app montou (teto de 8 s). Só anima transform/opacity (fica lisa com o app carregando).
  `apps/web/src/boot.ts` é o novo ponto de entrada: espera o 1º quadro pintar e só então importa `main.tsx`
  — sem isso a execução do bundle congelava a abertura por ~2 s. Respeita "reduzir movimento" do Windows.
- **Faixa de arrastar a janela (bug corrigido):** fora do editor o `DesktopApp` põe uma faixa de 44 px com
  `-webkit-app-region: drag` no topo. No Electron essa região CONTINUA valendo mesmo com outra camada por
  cima — clique ali vira "arrastar janela". Por isso o "Voltar" de Modelos/Projetos recentes não funcionava
  e o centro de "Explorar modelos" também não, e os botões minimizar/maximizar/fechar sumiam na tela
  inicial. Agora cada tela de boas-vindas tem a própria barra (`WelcomeTitleBar` em `WelcomeScreen.tsx`)
  com os botões da janela, e o conteúdo clicável fica abaixo dela com `no-drag`. Ao criar telas que cobrem
  o app inteiro, repetir isso.
- 2 testes do upstream (`LearnSheet`, `WatchFoldersPanel`) procuram o texto "OpenReel" e falham depois do
  rebrand; é esperado.

## Correções próprias (bugs do OpenReel original)

Achados no teste completo de 2026-11-21. Ficam no código-fonte; se um `git pull` der conflito
nesses arquivos, mantenha a lógica abaixo.

- **Mídias offline ao reabrir projeto** (`apps/web/src/services/desktop-ingest.ts`,
  `project-replacement.ts`, `agent/path-import.ts`): ao abrir um `.oreel`, as mídias voltam offline e o
  desktop as reconecta pelo caminho salvo, mas (1) só quando o ID do projeto muda, então reabrir o projeto
  atual deixava tudo offline; (2) a reconexão corria em segundo plano e um Export logo após abrir falhava com
  "Relink the original media". Agora a reconexão é fila única, roda a cada abertura de arquivo, e o
  `open_project_file` da IA espera ela terminar.

## Gotcha do build no Windows

Se o electron-builder falhar com "Cannot create symbolic link" (pacote `winCodeSign`), extraia o `.7z`
de `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` para a pasta `winCodeSign-2.6.0` ali mesmo com o
`7za.exe` do `node_modules`. Os 2 erros de atalhos de macOS podem ser ignorados.
