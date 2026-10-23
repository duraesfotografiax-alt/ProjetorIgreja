import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JanelaSite } from '../src/navegador.js';
import { procurarNavegador } from '../src/abrir.js';

// Usa o Chrome/Edge do computador; no desenvolvimento, o Chromium do Playwright. Sem navegador, pula.
function achar() {
  const instalado = procurarNavegador();
  if (instalado) return instalado;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return null;
  const pasta = readdirSync(base).find((n) => /^chromium-\d+$/.test(n));
  const caminho = pasta && path.join(base, pasta, 'chrome-linux', 'chrome');
  return caminho && existsSync(caminho) ? caminho : null;
}
const navegador = achar();

const pagina = '<title>Site de teste</title><video id=v loop></video><iframe srcdoc="<audio id=a></audio>"></iframe>';

test('procurarNavegador respeita PROJETOR_NAVEGADOR e não inventa caminho', () => {
  assert.equal(procurarNavegador({ PROJETOR_NAVEGADOR: '/nao/existe' }, 'linux'), null);
  assert.equal(procurarNavegador({ PROJETOR_NAVEGADOR: process.execPath }, 'linux'), process.execPath);
});

test('janela do site: abre, ajusta volume e som (inclusive em outro quadro) e fecha', { skip: !navegador && 'sem Chrome/Edge' }, async () => {
  const servidor = http.createServer((_q, r) => { r.setHeader('content-type', 'text/html'); r.end(pagina); }).listen(0);
  const perfil = await mkdtemp(path.join(tmpdir(), 'projetor-perfil-'));
  const janela = new JanelaSite({ caminho: navegador, perfil, semJanela: true });
  const url = `http://localhost:${servidor.address().port}/`;
  try {
    assert.equal(janela.disponivel, true);
    await janela.abrir(url, { volume: 0.5, tocando: true });
    let medias = await janela.consultar();
    assert.equal(medias.length, 2); // o vídeo da página e o áudio do quadro
    assert.ok(medias.every((m) => m.volume === 0.5 && m.mudo === false), JSON.stringify(medias));

    await janela.ajustar({ volume: 0.2, tocando: false }); // silenciar pelo celular
    medias = await janela.consultar();
    assert.ok(medias.every((m) => m.volume === 0.2 && m.mudo === true), JSON.stringify(medias));

    await janela.abrir(url, { volume: 1, tocando: true }); // mesmo endereço: reaproveita a janela
    assert.equal((await janela.consultar()).length, 2);

    await janela.fechar();
    assert.deepEqual(await janela.consultar(), []);
    await janela.abrir(url, { volume: 0.7, tocando: true }); // reabre depois de fechar
    assert.equal((await janela.consultar())[0].volume, 0.7);
  } finally {
    await janela.fechar();
    servidor.close();
    await rm(perfil, { recursive: true, force: true });
  }
});

test('sem navegador instalado, a janela do site fica indisponível (o programa usa a captura)', () => {
  assert.equal(new JanelaSite({ caminho: null }).disponivel, false);
});
