// Abre coisas no computador do telão: páginas na internet, o telão em janela de aplicativo e pastas.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function disparar(comando, argumentos) {
  // Sem shell: o endereço vai como argumento, nunca é interpretado como comando.
  spawn(comando, argumentos, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

// Abre um endereço (http/https) no navegador padrão do computador.
export function abrirLink(url) {
  if (!/^https?:\/\//i.test(url)) return;
  if (process.platform === 'win32') disparar('rundll32', ['url.dll,FileProtocolHandler', url]);
  else disparar(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
}

export function abrirPasta(pasta) {
  disparar(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [pasta]);
}

// Navegador Chrome ou Edge instalado no Windows (o Edge já vem com o Windows).
function navegadorWindows(env = process.env) {
  const bases = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LocalAppData].filter(Boolean);
  const candidatos = [
    ...bases.map((b) => path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    ...bases.map((b) => path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
  ];
  return candidatos.find((c) => existsSync(c)) ?? null;
}

// Abre o telão numa janela de aplicativo (sem abas nem barra de endereço) quando dá;
// senão, no navegador padrão.
export function abrirTelao(url) {
  if (process.platform === 'win32') {
    const navegador = navegadorWindows();
    if (navegador) { disparar(navegador, [`--app=${url}`, '--window-size=1280,720']); return; }
  }
  abrirLink(url);
}
