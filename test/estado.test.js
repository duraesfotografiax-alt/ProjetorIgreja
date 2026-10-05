import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, aplicarComando, ajustarAposRemocao, adicionarAoDia, diaDaSemana, DIAS } from '../src/estado.js';

const itens = [
  { id: 'abertura', tipo: 'slides', slides: ['001.jpg', '002.jpg', '003.jpg'] },
  { id: 'louvor', tipo: 'musica', estrofes: ['Estrofe 1', 'Refrão'] },
  { id: 'clipe', tipo: 'video', arquivo: 'video.mp4' },
];

test('abrir mostra o item e desliga a tela preta', () => {
  const e = aplicarComando({ ...estadoInicial(), telaPreta: true }, { acao: 'abrir', id: 'abertura', slide: 1 }, itens);
  assert.deepEqual(e.atual, { id: 'abertura', slide: 1, dia: null });
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
  assert.deepEqual(e.atual, { id: 'abertura', slide: 2, dia: null });
});

test('música avança pelas estrofes', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'abrir', id: 'louvor' }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.deepEqual(e.atual, { id: 'louvor', slide: 1, dia: null });
});

test('na lista do dia, próximo no fim passa para o item seguinte e anterior volta ao fim do anterior', () => {
  let e = estadoInicial({ qua: ['abertura', 'louvor', 'clipe'] }, 'seg');
  e = aplicarComando(e, { acao: 'abrir', id: 'abertura', slide: 2, dia: 'qua' }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.deepEqual(e.atual, { id: 'louvor', slide: 0, dia: 'qua' });
  e = aplicarComando(e, { acao: 'anterior' }, itens);
  assert.deepEqual(e.atual, { id: 'abertura', slide: 2, dia: 'qua' });
});

test('cada dia segue a sua própria ordem', () => {
  const cultos = { dom: ['louvor', 'abertura'], seg: ['louvor', 'clipe'] };
  let e = aplicarComando(estadoInicial(cultos, 'dom'), { acao: 'abrir', id: 'louvor', slide: 1, dia: 'seg' }, itens);
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.equal(e.atual.id, 'clipe');
});

test('abrir sem dia usa a lista de hoje, se o item estiver nela', () => {
  let e = estadoInicial({ sex: ['louvor', 'abertura'] }, 'sex');
  e = aplicarComando(e, { acao: 'abrir', id: 'louvor', slide: 1 }, itens);
  assert.equal(e.atual.dia, 'sex');
  e = aplicarComando(e, { acao: 'proximo' }, itens);
  assert.equal(e.atual.id, 'abertura');

  const fora = aplicarComando(estadoInicial({}, 'sex'), { acao: 'abrir', id: 'louvor' }, itens);
  assert.equal(fora.atual.dia, null);
});

test('na lista do dia, chegar no vídeo já começa a tocar', () => {
  let e = estadoInicial({ seg: ['louvor', 'clipe'] }, 'seg');
  e = aplicarComando(e, { acao: 'abrir', id: 'louvor', slide: 1, dia: 'seg' }, itens);
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

test('lista do dia ignora itens inexistentes e repetidos, e dia inválido', () => {
  const e = aplicarComando(estadoInicial(), { acao: 'culto', dia: 'ter', itens: ['louvor', 'nada', 'louvor', 'clipe'] }, itens);
  assert.deepEqual(e.cultos.ter, ['louvor', 'clipe']);
  assert.deepEqual(e.cultos.qua, []);
  assert.equal(aplicarComando(e, { acao: 'culto', dia: 'feriado', itens: [] }, itens), e);
});

test('o mesmo item pode estar em vários dias', () => {
  let e = aplicarComando(estadoInicial(), { acao: 'culto', dia: 'dom', itens: ['louvor'] }, itens);
  e = aplicarComando(e, { acao: 'culto', dia: 'seg', itens: ['louvor'] }, itens);
  assert.deepEqual([e.cultos.dom, e.cultos.seg], [['louvor'], ['louvor']]);
});

test('adicionarAoDia põe no fim sem repetir', () => {
  let e = estadoInicial({ qui: ['louvor'] });
  e = adicionarAoDia(e, 'qui', ['clipe', 'louvor']);
  assert.deepEqual(e.cultos.qui, ['louvor', 'clipe']);
  assert.equal(adicionarAoDia(e, '', ['clipe']), e);
});

test('dias da semana: segunda a domingo, e o dia de hoje pela data', () => {
  assert.deepEqual(DIAS, ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
  assert.equal(diaDaSemana(new Date(2026, 9, 4)), 'dom'); // 4/10/2026 é domingo
  assert.equal(diaDaSemana(new Date(2026, 9, 5)), 'seg');
  assert.equal(diaDaSemana(new Date(2026, 9, 10)), 'sab');
});

test('comando desconhecido é ignorado', () => {
  const e = estadoInicial();
  assert.equal(aplicarComando(e, { acao: 'formatar-disco' }, itens), e);
  assert.equal(aplicarComando(e, null, itens), e);
});

test('apagar um item tira do telão e das listas de todos os dias', () => {
  const e = { ...estadoInicial({ dom: ['louvor', 'clipe'], seg: ['clipe'] }), atual: { id: 'clipe', slide: 0, dia: 'dom' } };
  const depois = ajustarAposRemocao(e, itens.slice(0, 2));
  assert.equal(depois.atual, null);
  assert.deepEqual(depois.cultos.dom, ['louvor']);
  assert.deepEqual(depois.cultos.seg, []);
  assert.equal(ajustarAposRemocao(e, itens), e);
});
