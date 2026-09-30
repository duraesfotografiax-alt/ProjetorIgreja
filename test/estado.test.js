import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, aplicarComando, ajustarAposRemocao } from '../src/estado.js';

const aps = [
  { id: 'culto', slides: ['001.jpg', '002.jpg', '003.jpg'] },
  { id: 'aviso', slides: ['001.jpg'] },
];

test('abrir mostra a apresentação e desliga a tela preta', () => {
  const e = aplicarComando({ atual: null, telaPreta: true }, { acao: 'abrir', id: 'culto', slide: 1 }, aps);
  assert.deepEqual(e, { atual: { id: 'culto', slide: 1 }, telaPreta: false });
});

test('abrir ignora apresentação que não existe', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'abrir', id: 'nada' }, aps), e);
});

test('próximo e anterior param no primeiro e no último slide', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'culto' }, aps);
  e = aplicarComando(e, { acao: 'anterior' }, aps);
  assert.equal(e.atual.slide, 0);
  for (let i = 0; i < 5; i++) e = aplicarComando(e, { acao: 'proximo' }, aps);
  assert.equal(e.atual.slide, 2);
});

test('próximo sem nada no telão não faz nada', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'proximo' }, aps), e);
});

test('tela preta liga e desliga', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'telaPreta', ligada: true }, aps);
  assert.equal(e.telaPreta, true);
  e = aplicarComando(e, { acao: 'telaPreta', ligada: false }, aps);
  assert.equal(e.telaPreta, false);
});

test('comando desconhecido é ignorado', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'formatar-disco' }, aps), e);
  assert.equal(aplicarComando(e, null, aps), e);
});

test('apagar a apresentação do telão volta para a tela inicial', () => {
  const e = { atual: { id: 'aviso', slide: 0 }, telaPreta: false };
  assert.equal(ajustarAposRemocao(e, [aps[0]]).atual, null);
  assert.equal(ajustarAposRemocao(e, aps), e);
});
