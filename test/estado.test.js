import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, aplicarComando, ajustarAposRemocao } from '../src/estado.js';

const itens = [
  { id: 'abertura', tipo: 'slides', slides: ['001.jpg', '002.jpg', '003.jpg'] },
  { id: 'louvor', tipo: 'musica', estrofes: ['Estrofe 1', 'Refrão'] },
  { id: 'clipe', tipo: 'video', arquivo: 'video.mp4' },
];

test('abrir mostra o item e desliga a tela preta', () => {
  const e = aplicarComando({ ...estadoInicial(), telaPreta: true }, { acao: 'abrir', id: 'abertura', slide: 1 }, itens);
  assert.deepEqual(e.atual, { id: 'abertura', slide: 1 });
  assert.equal(e.telaPreta, false);
});

test('abrir ignora item que não existe', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'abrir', id: 'nada' }, itens), e);
});

test('próximo e anterior param no primeiro e no último slide fora do culto', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'abertura' }, itens);
  e = aplicarComando(e, { acao: 'anterior' }, itens);
  assert.equal(e.atual.slide, 0);
  for (let i = 0; i < 5; i++) e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.deepEqual(e.atual, { id: 'abertura', slide: 2 });
});

test('música avança pelas estrofes', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'louvor' }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.deepEqual(e.atual, { id: 'louvor', slide: 1 });
});

test('no culto, próximo no fim passa para o item seguinte e anterior volta ao fim do anterior', () => {
  let e = estadoInicial(['abertura', 'louvor', 'clipe']);
  e = aplicarComando(e, { acao: 'abrir', id: 'abertura', slide: 2 }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.deepEqual(e.atual, { id: 'louvor', slide: 0 });
  e = aplicarComando(e, { acao: 'anterior' }, itens);
  assert.deepEqual(e.atual, { id: 'abertura', slide: 2 });
});

test('no culto, chegar no vídeo já começa a tocar', () => {
  let e = estadoInicial(['louvor', 'clipe']);
  e = aplicarComando(e, { acao: 'abrir', id: 'louvor', slide: 1 }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.equal(e.atual.id, 'clipe');
  assert.equal(e.video.tocando, true);
});

test('próximo sem nada no telão não faz nada', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'proximo' }, itens), e);
});

test('vídeo: tocar, pausar, reiniciar e volume', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'clipe' }, itens);
  const reinicio = e.video.reinicio;
  e = aplicarComando(e, { acao: 'video', comando: 'pausar' }, itens);
  assert.equal(e.video.tocando, false);
  e = aplicarComando(e, { acao: 'video', comando: 'reiniciar' }, itens);
  assert.deepEqual(e.video, { tocando: true, reinicio: reinicio + 1 });
  e = aplicarComando(e, { acao: 'volume', valor: 3 }, itens);
  assert.equal(e.volume, 1);
  e = aplicarComando(e, { acao: 'volume', valor: 0.4 }, itens);
  assert.equal(e.volume, 0.4);
});

test('comandos de vídeo são ignorados quando não há vídeo no telão', () => {
  const e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'louvor' }, itens);
  assert.equal(aplicarComando(e, { acao: 'video', comando: 'tocar' }, itens), e);
});

test('tela preta liga e desliga', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'telaPreta', ligada: true }, itens);
  assert.equal(e.telaPreta, true);
  e = aplicarComando(e, { acao: 'telaPreta', ligada: false }, itens);
  assert.equal(e.telaPreta, false);
});

test('lista do culto ignora itens inexistentes e repetidos', () => {
  const e = aplicarComando(estadoInicial(), { acao: 'culto', itens: ['louvor', 'nada', 'louvor', 'clipe'] }, itens);
  assert.deepEqual(e.culto, ['louvor', 'clipe']);
});

test('comando desconhecido é ignorado', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'formatar-disco' }, itens), e);
  assert.equal(aplicarComando(e, null, itens), e);
});

test('apagar um item tira do telão e da lista do culto', () => {
  const e = { ...estadoInicial(['louvor', 'clipe']), atual: { id: 'clipe', slide: 0 } };
  const depois = ajustarAposRemocao(e, itens.slice(0, 2));
  assert.equal(depois.atual, null);
  assert.deepEqual(depois.culto, ['louvor']);
  assert.equal(ajustarAposRemocao(e, itens), e);
});
