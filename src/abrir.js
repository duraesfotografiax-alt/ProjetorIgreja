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

// Chrome ou Edge instalado (o Edge já vem com o Windows). PROJETOR_NAVEGADOR escolhe outro.
export function procurarNavegador(env = process.env, plataforma = process.platform) {
  if (env.PROJETOR_NAVEGADOR && existsSync(env.PROJETOR_NAVEGADOR)) return env.PROJETOR_NAVEGADOR;
  let candidatos;
  if (plataforma === 'win32') {
    const bases = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LocalAppData].filter(Boolean);
    candidatos = [
      ...bases.map((b) => path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...bases.map((b) => path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ];
  } else if (plataforma === 'darwin') {
    candidatos = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  } else {
    candidatos = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  }
  return candidatos.find((c) => existsSync(c)) ?? null;
}

// Abre o telão numa janela de aplicativo (sem abas nem barra de endereço). Com perfil próprio, o
// navegador libera o som sem precisar de clique. Sem Chrome/Edge, abre no navegador padrão.
export function abrirTelao(url, { perfil } = {}) {
  const navegador = procurarNavegador();
  if (navegador) {
    disparar(navegador, [`--app=${url}`, '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required',
      '--no-first-run', '--no-default-browser-check', perfil ? `--user-data-dir=${perfil}` : null].filter(Boolean));
    return;
  }
  abrirLink(url);
}
