import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { criarServidor, PASTA_RAIZ } from '../src/servidor.js';
import { diaDaSemana } from '../src/estado.js';
import { criarPdf } from './util.js';

// Recebe mensagens do WebSocket até uma delas satisfazer a condição.
function esperarEstado(socket, condicao) {
  return new Promise((resolve) => {
    const ouvir = (dados) => {
      const msg = JSON.parse(dados);
      if (condicao(msg)) { socket.off('message', ouvir); resolve(msg); }
    };
    socket.on('message', ouvir);
  });
}

test('envia PDF pelo celular, controla os slides e apaga', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const servidor = await criarServidor({
    pastaBiblioteca: pasta,
    pastaPublica: path.join(PASTA_RAIZ, 'public'),
    porta: 0,
  });
  const base = `http://localhost:${servidor.address().port}`;
  const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`);

  try {
    const inicial = await esperarEstado(socket, () => true);
    assert.deepEqual(inicial.itens.map((i) => i.id), ['tela']); // só o item fixo "Tela do computador"

    // Envio de PDF com nome acentuado
    const form = new FormData();
    form.append('dia', 'dom');
    form.append('arquivos', new Blob([criarPdf(['Um', 'Dois'])], { type: 'application/pdf' }), 'Culto de Domingo – Louvor.pdf');
    const avisado = esperarEstado(socket, (m) => m.itens.length === 2);
    const resposta = await fetch(`${base}/api/enviar`, { method: 'POST', body: form });
    assert.equal(resposta.status, 200);
    const { criados: [ap] } = await resposta.json();
    assert.equal(ap.nome, 'Culto de Domingo – Louvor');
    assert.deepEqual(ap.slides, ['001.jpg', '002.jpg']);
    assert.deepEqual((await avisado).estado.cultos.dom, [ap.id]); // já entrou na lista de domingo

    // Copiar um slide para terça e quinta
    const comCopiaPromessa = esperarEstado(socket, (m) => m.estado.cultos.qui.length === 1);
    const copiaResp = await fetch(`${base}/api/itens/${ap.id}/copiar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides: [1], dias: ['ter', 'qui'] }),
    });
    const { copia } = await copiaResp.json();
    assert.deepEqual(copia.slides, ['001.jpg']);
    const comCopia = await comCopiaPromessa;
    assert.deepEqual(comCopia.estado.cultos.qui, [copia.id]);
    assert.deepEqual(comCopia.estado.cultos.ter, [copia.id]);
    await fetch(`${base}/api/itens/${copia.id}`, { method: 'DELETE' });

    // A imagem do slide é servida
    const img = await fetch(`${base}/midia/${ap.id}/002.jpg`);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');

    // Controle pelo WebSocket
    socket.send(JSON.stringify({ acao: 'abrir', id: ap.id }));
    await esperarEstado(socket, (m) => m.estado.atual?.slide === 0);
    socket.send(JSON.stringify({ acao: 'proximo' }));
    await esperarEstado(socket, (m) => m.estado.atual?.slide === 1);

    // Arquivo de tipo errado é recusado com mensagem clara
    const errado = new FormData();
    errado.append('arquivos', new Blob(['oi']), 'nota.txt');
    const recusa = await fetch(`${base}/api/enviar`, { method: 'POST', body: errado });
    assert.equal(recusa.status, 400);
    assert.match((await recusa.json()).erro, /PDF/);

    // Apagar tira do telão
    const limpo = esperarEstado(socket, (m) => m.itens.length === 1 && m.estado.atual === null);
    await fetch(`${base}/api/itens/${ap.id}`, { method: 'DELETE' });
    await limpo;

    // Link do YouTube vira item e entra no dia escolhido (nome informado: não precisa de internet)
    const ytAvisado = esperarEstado(socket, (m) => m.estado.cultos.sab.length === 1);
    const ytResp = await fetch(`${base}/api/youtube`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: 'https://youtu.be/dQw4w9WgXcQ', nome: 'Culto ao vivo', dia: 'sab' }),
    });
    const { item: yt } = await ytResp.json();
    assert.deepEqual([yt.tipo, yt.videoId, yt.nome], ['youtube', 'dQw4w9WgXcQ', 'Culto ao vivo']);
    await ytAvisado;
    const ytRuim = await fetch(`${base}/api/youtube`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: 'https://exemplo.com' }),
    });
    assert.equal(ytRuim.status, 400);
    await fetch(`${base}/api/itens/${yt.id}`, { method: 'DELETE' });

    // Ícone na tela inicial: manifesto e ícones
    const manifesto = await fetch(`${base}/manifest.webmanifest`);
    assert.match(manifesto.headers.get('content-type'), /manifest\+json/);
    assert.equal((await manifesto.json()).start_url, '/controle.html');
    assert.equal((await fetch(`${base}/icones/icone-512.png`)).headers.get('content-type'), 'image/png');

    // A tela do computador é um item fixo: abre no telão e não pode ser apagada
    socket.send(JSON.stringify({ acao: 'abrir', id: 'tela' }));
    const comTela = await esperarEstado(socket, (m) => m.estado.atual?.id === 'tela');
    assert.equal(comTela.estado.video.tocando, true);
    assert.equal((await fetch(`${base}/api/itens/tela`, { method: 'DELETE' })).status, 400);

    // QR code de conexão
    const conexao = await (await fetch(`${base}/api/conexao`)).json();
    assert.match(conexao.qrcode, /^data:image\/png;base64,/);
  } finally {
    socket.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});

test('cadastra música, monta a lista do dia e ela continua salva ao reiniciar', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const opcoes = { pastaBiblioteca: pasta, pastaPublica: path.join(PASTA_RAIZ, 'public'), porta: 0 };
  let servidor = await criarServidor(opcoes);
  let base = `http://localhost:${servidor.address().port}`;
  let socket = new WebSocket(`${base.replace('http', 'ws')}/ws`);

  try {
    await esperarEstado(socket, () => true);
    const resposta = await fetch(`${base}/api/musicas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Aleluia', letra: 'Aleluia\n\nAmém' }),
    });
    assert.equal(resposta.status, 200);
    const { musica } = await resposta.json();
    assert.deepEqual(musica.estrofes, ['Aleluia', 'Amém']);

    const semLetra = await fetch(`${base}/api/musicas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'X' }),
    });
    assert.equal(semLetra.status, 400);

    socket.send(JSON.stringify({ acao: 'culto', dia: 'qua', itens: [musica.id] }));
    await esperarEstado(socket, (m) => m.estado.cultos.qua.length === 1);

    // Reinicia o programa: a lista do culto continua lá
    socket.close();
    await new Promise((r) => servidor.close(r));
    servidor = await criarServidor(opcoes);
    base = `http://localhost:${servidor.address().port}`;
    socket = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    const depois = await esperarEstado(socket, () => true);
    assert.deepEqual(depois.estado.cultos.qua, [musica.id]);
    assert.equal(depois.estado.hoje, diaDaSemana());
  } finally {
    socket.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});

test('a lista única da versão anterior vira a lista de hoje', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const id = 'antigo';
  await mkdir(path.join(pasta, id));
  await writeFile(path.join(pasta, id, 'info.json'),
    JSON.stringify({ id, tipo: 'musica', nome: 'A', criadaEm: '2026-01-01', estrofes: ['a'], letra: 'a' }));
  await writeFile(path.join(pasta, 'culto.json'), JSON.stringify([id]));
  const servidor = await criarServidor({ pastaBiblioteca: pasta, pastaPublica: path.join(PASTA_RAIZ, 'public'), porta: 0 });
  const socket = new WebSocket(`ws://localhost:${servidor.address().port}/ws`);
  try {
    const { estado } = await esperarEstado(socket, () => true);
    assert.deepEqual(estado.cultos[diaDaSemana()], [id]);
  } finally {
    socket.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});

test('sem Chrome/Edge, o link de site abre no navegador padrão uma vez e o telão usa a captura', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const abertos = [];
  const servidor = await criarServidor({
    pastaBiblioteca: pasta, pastaPublica: path.join(PASTA_RAIZ, 'public'), porta: 0, abrirLink: (url) => abertos.push(url),
    janelaSite: { disponivel: false }, // sem Chrome/Edge: cai no navegador padrão + captura
  });
  const base = `http://localhost:${servidor.address().port}`;
  const socket = new WebSocket(`ws://localhost:${servidor.address().port}/ws`);
  const enviar = (corpo) => fetch(`${base}/api/link`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  try {
    await esperarEstado(socket, () => true);

    // YouTube é reconhecido sozinho, no mesmo campo
    const yt = (await (await enviar({ link: 'https://youtu.be/dQw4w9WgXcQ', nome: 'Culto', dia: 'dom' })).json()).item;
    assert.deepEqual([yt.tipo, yt.videoId], ['youtube', 'dQw4w9WgXcQ']);

    // Qualquer outro endereço vira site
    const resposta = await enviar({ link: 'univervideo.com/watch/live/terapia-do-amor-20h', nome: 'Terapia do Amor', dia: 'seg' });
    assert.equal(resposta.status, 200);
    const { item } = await resposta.json();
    assert.deepEqual([item.tipo, item.nome, item.link], ['site', 'Terapia do Amor', 'https://univervideo.com/watch/live/terapia-do-amor-20h']);
    assert.equal((await enviar({ link: 'isto não é link' })).status, 400);
    assert.equal((await enviar({ link: '' })).status, 400);
    assert.deepEqual(abertos, []); // só guardar não abre nada

    // Ir para o telão abre a página no computador, uma única vez
    socket.send(JSON.stringify({ acao: 'abrir', id: item.id }));
    const noAr = await esperarEstado(socket, (m) => m.estado.atual?.id === item.id);
    assert.equal(noAr.estado.video.tocando, true);
    assert.deepEqual(abertos, [item.link]);
    socket.send(JSON.stringify({ acao: 'proximo' }));
    socket.send(JSON.stringify({ acao: 'telaPreta', ligada: true }));
    await esperarEstado(socket, (m) => m.estado.telaPreta);
    assert.equal(abertos.length, 1);

    // Botão "abrir de novo no computador"
    assert.equal((await fetch(`${base}/api/itens/${item.id}/abrir-no-computador`, { method: 'POST' })).status, 200);
    assert.equal(abertos.length, 2);
    assert.equal((await fetch(`${base}/api/itens/${yt.id}/abrir-no-computador`, { method: 'POST' })).status, 400);

    // Endereços para conectar o celular
    const conexao = await (await fetch(`${base}/api/conexao`)).json();
    assert.match(conexao.url, /^http:\/\/.+:\d+\/$/);
    assert.ok(conexao.urlNome === null || /^http:\/\/[a-z0-9-]+\.local:\d+\/$/.test(conexao.urlNome));
  } finally {
    socket.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});

test('site em tela cheia: o programa abre a janela, segue volume e silenciar, e fecha ao tirar do ar', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const chamadas = [];
  const janelaSite = {
    disponivel: true,
    abrir: async (url, opcoes) => { chamadas.push(['abrir', url, opcoes.tela, opcoes.volume]); },
    ajustar: async (alvo) => { chamadas.push(['ajustar', alvo]); },
    fechar: async () => { chamadas.push(['fechar']); },
  };
  const abertos = [];
  const servidor = await criarServidor({
    pastaBiblioteca: pasta, pastaPublica: path.join(PASTA_RAIZ, 'public'), porta: 0, abrirLink: (u) => abertos.push(u), janelaSite,
  });
  const base = `http://localhost:${servidor.address().port}`;
  const telao = new WebSocket(`ws://localhost:${servidor.address().port}/ws`);
  const celular = new WebSocket(`ws://localhost:${servidor.address().port}/ws`);
  try {
    // O telão diz onde está (segundo monitor, por exemplo)
    await esperarEstado(telao, () => true);
    telao.send(JSON.stringify({ acao: 'ola', papel: 'telao', tela: { x: 1920, y: 0, w: 1280, h: 720 } }));
    await esperarEstado(celular, () => true);
    const { item } = await (await fetch(`${base}/api/link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: 'univervideo.com/br', nome: 'Univer' }),
    })).json();

    celular.send(JSON.stringify({ acao: 'abrir', id: item.id }));
    const noAr = await esperarEstado(celular, (m) => m.site?.modo === 'janela');
    assert.equal(noAr.estado.atual.id, item.id);
    assert.deepEqual(chamadas[0], ['abrir', 'https://univervideo.com/br', { x: 1920, y: 0, w: 1280, h: 720 }, 1]);
    assert.deepEqual(abertos, []); // não usa o navegador padrão

    // Volume e silenciar pelo celular chegam na janela
    celular.send(JSON.stringify({ acao: 'volume', valor: 0.3 }));
    await esperarEstado(celular, (m) => m.estado.volume === 0.3);
    celular.send(JSON.stringify({ acao: 'video', comando: 'pausar' })); // "Silenciar"
    await esperarEstado(celular, (m) => m.estado.video.tocando === false);
    assert.deepEqual(chamadas.filter((c) => c[0] === 'ajustar').at(-1), ['ajustar', { volume: 0.3, tocando: false }]);

    // Tirar do ar fecha a janela, e o aviso de modo some
    celular.send(JSON.stringify({ acao: 'fechar' }));
    const fora = await esperarEstado(celular, (m) => m.estado.atual === null);
    assert.equal(fora.site, null);
    assert.deepEqual(chamadas.at(-1), ['fechar']);

    // Se a janela falhar ao abrir, cai no navegador padrão + captura
    janelaSite.abrir = async () => { throw new Error('Chrome travou'); };
    celular.send(JSON.stringify({ acao: 'abrir', id: item.id }));
    const plano = await esperarEstado(celular, (m) => m.site?.modo === 'captura');
    assert.equal(plano.site.modo, 'captura');
    assert.deepEqual(abertos, ['https://univervideo.com/br']);
  } finally {
    telao.close(); celular.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});

test('Bíblia: lê os arquivos da pasta, navega, busca, mostra o versículo no telão e aceita arquivo enviado pelo celular', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-srv-'));
  const pastaBiblias = path.join(pasta, 'Bíblias');
  await mkdir(pastaBiblias);
  // Versículos INVENTADOS
  await writeFile(path.join(pastaBiblias, 'TESTE.csv'),
    'livro;capitulo;versiculo;texto\nGênesis;1;1;Primeiro de teste.\nGênesis;1;2;Segundo de teste.\nJoão;3;16;Texto inventado sobre amor.\nJoão;3;17;Mais um texto de teste.\n');
  await writeFile(path.join(pastaBiblias, 'quebrada.json'), '{ nao e json');
  const servidor = await criarServidor({ pastaBiblioteca: path.join(pasta, 'lib'), pastaPublica: path.join(PASTA_RAIZ, 'public'), porta: 0, pastaBiblias, janelaSite: { disponivel: false } });
  const base = `http://localhost:${servidor.address().port}`;
  const socket = new WebSocket(`ws://localhost:${servidor.address().port}/ws`);
  const get = async (rota) => (await fetch(`${base}${rota}`)).json();
  try {
    await esperarEstado(socket, () => true);
    const lista = await get('/api/biblias');
    assert.deepEqual(lista.versoes.map((v) => [v.id, v.versiculos]), [['TESTE', 4]]);
    assert.equal(lista.erros[0].arquivo, 'quebrada.json');

    const livros = await get('/api/biblia/TESTE/livros');
    assert.deepEqual(livros.map((l) => [l.nome, l.capitulos, l.antigo]), [['Gênesis', 1, true], ['João', 3, false]]);
    assert.deepEqual((await get('/api/biblia/TESTE/1/3')).versiculos.slice(15), ['Texto inventado sobre amor.', 'Mais um texto de teste.']);
    assert.equal((await fetch(`${base}/api/biblia/NAO/livros`)).status, 400);

    const busca = await get('/api/biblia/TESTE/busca?q=' + encodeURIComponent('jo 3:16-17'));
    assert.deepEqual([busca.referencia.livro, busca.referencia.de, busca.referencia.ate, busca.referencia.versiculos.length], ['João', 16, 17, 2]);
    assert.equal((await get('/api/biblia/TESTE/busca?q=amor')).resultados[0].cap, 3);

    // Mostrar o versículo 16 no telão: o capítulo todo fica carregado e Avançar passa para o 17
    const noAr = esperarEstado(socket, (m) => m.estado.atual?.id === 'biblia');
    await fetch(`${base}/api/biblia/abrir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versao: 'TESTE', livro: 1, cap: 3, verso: 16 }) });
    const m = await noAr;
    const item = m.itens.find((i) => i.id === 'biblia');
    assert.deepEqual([m.estado.atual.slide, item.nome, item.versiculos.length], [15, 'João 3 · TESTE', 17]);
    socket.send(JSON.stringify({ acao: 'proximo' }));
    assert.equal((await esperarEstado(socket, (x) => x.estado.atual?.slide === 16)).estado.atual.id, 'biblia');

    // Arquivo enviado pelo celular: confere se dá para ler, e recusa o que não dá
    const bom = new FormData();
    bom.append('arquivo', new Blob(['Rute;1;1;Texto de teste de Rute.\n']), 'OUTRA.csv');
    assert.equal((await fetch(`${base}/api/biblias`, { method: 'POST', body: bom })).status, 200);
    assert.deepEqual((await get('/api/biblias')).versoes.map((v) => v.id), ['OUTRA', 'TESTE']);
    const ruim = new FormData();
    ruim.append('arquivo', new Blob(['isto não é uma Bíblia']), 'RUIM.csv');
    const resposta = await fetch(`${base}/api/biblias`, { method: 'POST', body: ruim });
    assert.equal(resposta.status, 400);
    assert.match((await resposta.json()).erro, /Não encontrei versículos/);
    const formato = new FormData();
    formato.append('arquivo', new Blob(['x']), 'biblia.pdf');
    assert.equal((await fetch(`${base}/api/biblias`, { method: 'POST', body: formato })).status, 400);
    assert.deepEqual((await get('/api/biblias')).versoes.map((v) => v.id), ['OUTRA', 'TESTE']);
  } finally {
    socket.close();
    servidor.close();
    await rm(pasta, { recursive: true, force: true });
  }
});
