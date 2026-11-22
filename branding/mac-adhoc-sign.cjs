// The Editor — assinatura ad-hoc do app no Mac (hook `afterSign` do electron-builder).
//
// Sem Apple Developer ID, o electron-builder pula a assinatura (mac.identity: null). Um .app
// alterado e sem assinatura válida aparece como "danificado" no macOS recente (Apple Silicon
// exige código assinado). A assinatura ad-hoc ("-") deixa o pacote íntegro: na 1ª abertura o
// macOS pede "Abrir Mesmo Assim" em Ajustes do Sistema → Privacidade e Segurança.
//
// Não roda no Windows/Linux. Quando houver Developer ID próprio, remova o afterSign do
// electron-builder.yml.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`[mac-adhoc-sign] assinando (ad-hoc): ${app}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
};
