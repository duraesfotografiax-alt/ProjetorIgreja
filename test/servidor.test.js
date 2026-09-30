import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { criarServidor, PASTA_RAIZ } from '../src/servidor.js';
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
    assert.equal(inicial.apresentacoes.length, 0);

    // Envio de PDF com nome acentuado
    const form = new FormData();
    form.append('arquivos', new Blob([criarPdf(['Um', 'Dois'])], { type: 'application/pdf' }), 'Culto de Domingo – Louvor.pdf');
    const avisado = esperarEstado(socket, (m) => m.apresentacoes.length === 1);
    const resposta = await fetch(`${base}/api/enviar`, { method: 'POST', body: form });
    assert.equal(resposta.status, 200);
    const { criadas: [ap] } = await resposta.json();
    assert.equal(ap.nome, 'Culto de Domingo – Louvor');
    assert.deepEqual(ap.slides, ['001.jpg', '002.jpg']);
    await avisado;

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
    const limpo = esperarEstado(socket, (m) => m.apresentacoes.length === 0 && m.estado.atual === null);
    await fetch(`${base}/api/apresentacoes/${ap.id}`, { method: 'DELETE' });
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
