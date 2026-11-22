// The Editor: ponto de entrada mínimo. Deixa o navegador pintar a abertura (index.html) ANTES de
// carregar e executar o app inteiro — senão a execução do bundle segura o primeiro quadro por ~2 s e a
// animação só começa depois. A abertura anima só transform/opacity (placa de vídeo), então continua lisa
// enquanto o app carrega por baixo.
let started = false;
const start = (): void => {
  if (started) return;
  started = true;
  void import("./main");
};
// Dois quadros garantem que a abertura já foi pintada; o timeout cobre janelas ainda ocultas (sem rAF).
requestAnimationFrame(() => requestAnimationFrame(start));
setTimeout(start, 250);
