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
    assert.equal(inicial.itens.length, 0);

    // Envio de PDF com nome acentuado
    const form = new FormData();
    form.append('dia', 'dom');
    form.append('arquivos', new Blob([criarPdf(['Um', 'Dois'])], { type: 'application/pdf' }), 'Culto de Domingo – Louvor.pdf');
    const avisado = esperarEstado(socket, (m) => m.itens.length === 1);
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
    const limpo = esperarEstado(socket, (m) => m.itens.length === 0 && m.estado.atual === null);
    await fetch(`${base}/api/itens/${ap.id}`, { method: 'DELETE' });
    await limpo;

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
