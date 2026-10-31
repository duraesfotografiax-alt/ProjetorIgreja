import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Biblia, PastaDeBiblias, identificarLivro, lerBiblia, lerReferencia, LIVROS } from '../src/biblia.js';

// Versículos INVENTADOS (o programa não traz texto bíblico; os testes também não).
const V = { g11: 'Texto inventado um.', g12: 'Texto inventado dois, com vírgula.', g21: 'Outro capítulo.', jo316: 'Versículo de teste, amor e prova.', jo317: 'Segundo versículo de teste.', job11: 'Livro de Jó de teste.' };

function conferir(b) {
  assert.deepEqual(b.livros.map((l) => l.nome), ['Gênesis', 'Jó', 'João']);
  assert.deepEqual(b.livros[0].capitulos, [[V.g11, V.g12], [V.g21]]);
  assert.equal(b.livros[2].capitulos[2][15], V.jo316);
  assert.equal(b.versiculos, 6);
}

test('identifica livros por nome, abreviação, número e variações', () => {
  assert.equal(LIVROS.length, 66);
  const casos = { 'João': 42, 'Jo': 42, 'Jó': 17, 'Job': 17, '1 Co': 45, '1º Coríntios': 45, 'I Coríntios': 45, 'Primeiro Coríntios': 45, '2Tm': 54, '1Tm': 53,
    'Sl': 18, 'salmo': 18, 'Salmos': 18, 'Cantares': 21, 'Cântico dos Cânticos': 21, 'Ap': 65, 'apocalipse': 65, 'Gênesis': 0, 'genesis': 0, '19': 18, '66': 65 };
  for (const [texto, posicao] of Object.entries(casos)) assert.equal(identificarLivro(texto), posicao, texto);
  for (const ruim of ['', 'xyz', '0', '67', 'Livro de Mórmon']) assert.equal(identificarLivro(ruim), -1, ruim);
});

test('lê CSV com ponto e vírgula, cabeçalho e livro por nome ou número', () => {
  const csv = `livro;capitulo;versiculo;texto\nGênesis;1;1;${V.g11}\nGênesis;1;2;${V.g12}\nGênesis;2;1;${V.g21}\n18;1;1;${V.job11}\nJoão;3;16;${V.jo316}\nJoão;3;17;${V.jo317}\n`
    .replace('18;1;1', 'Jó;1;1');
  const b = lerBiblia(csv, 'ARC.csv');
  assert.equal(b.versao, 'ARC');
  assert.deepEqual(b.livros.map((l) => l.nome), ['Gênesis', 'Jó', 'João']);
  assert.equal(b.livros[2].capitulos[2][16 - 1], V.jo316);
});

test('lê CSV com vírgula (texto com vírgulas), tabulação e aspas', () => {
  const virgula = lerBiblia(`Gênesis,1,1,${V.g12}\nGênesis,1,2,"Com ""aspas"", e vírgula"\n`, 'X.csv');
  assert.deepEqual(virgula.livros[0].capitulos[0], [V.g12, 'Com "aspas", e vírgula']);
  const tab = lerBiblia(`Gênesis\t1\t1\t${V.g11}\n`, 'X.tsv');
  assert.equal(tab.livros[0].capitulos[0][0], V.g11);
  const bom = lerBiblia(`﻿livro;capitulo;versiculo;texto\r\nRute;1;1;Texto.\r\n`, 'X.csv'); // BOM e fim de linha do Windows
  assert.equal(bom.livros[0].nome, 'Rute');
});

test('lê JSON em lista de livros e JSON em objeto', () => {
  const lista = [
    { abbrev: 'gn', name: 'Gênesis', chapters: [[V.g11, V.g12], [V.g21]] },
    { abbrev: 'job', name: 'Jó', chapters: [[V.job11]] },
    { abbrev: 'jo', name: 'João', chapters: [[], [], [...Array(15).fill('x'), V.jo316, V.jo317]] },
  ];
  const a = lerBiblia(JSON.stringify(lista), 'ARC.json');
  assert.equal(a.livros[2].capitulos[2][15], V.jo316);
  const objeto = { 'Gênesis': { 1: { 1: V.g11, 2: V.g12 }, 2: { 1: V.g21 } }, 'Jó': [[V.job11]], 'João': { 3: { 16: V.jo316, 17: V.jo317 } } };
  const b = lerBiblia(JSON.stringify(objeto), 'ARC.json');
  assert.deepEqual(b.livros[0].capitulos, [[V.g11, V.g12], [V.g21]]);
  assert.equal(b.livros[2].capitulos[2][16], V.jo317);
});

test('lê XML Zefania, com entidades e marcas dentro do versículo', () => {
  const xml = `<?xml version="1.0"?><XMLBIBLE><BIBLEBOOK bnumber="1" bname="Gênesis"><CHAPTER cnumber="1"><VERS vnumber="1">${V.g11}</VERS>` +
    `<VERS vnumber="2">Com &amp; e <NOTE>nota</NOTE>marca &#233;.</VERS></CHAPTER></BIBLEBOOK><BIBLEBOOK bnumber="43"><CHAPTER cnumber="3"><VERS vnumber="16">${V.jo316}</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`;
  const b = lerBiblia(xml, 'Z.xml');
  assert.equal(b.livros[0].capitulos[0][1], 'Com & e nota marca é.');
  assert.equal(b.livros[1].nome, 'João'); // livro identificado pelo número
});

test('lê texto simples, um versículo por linha', () => {
  const b = lerBiblia(`Gênesis 1:1 ${V.g11}\n1 Coríntios 13:4 - Texto de teste.\nJoão 3:16 ${V.jo316}\n\nlinha solta sem referência\n`, 'T.txt');
  assert.deepEqual(b.livros.map((l) => l.nome), ['Gênesis', 'João', '1 Coríntios']);
  assert.equal(b.livros[2].capitulos[12][3], 'Texto de teste.');
});

test('versículo que falta fica vazio, livro desconhecido é mantido, arquivo vazio dá erro claro', () => {
  const b = lerBiblia(`Gênesis;1;1;a\nGênesis;1;3;c\nLivro Novo;1;1;x\n`, 'X.csv');
  assert.deepEqual(b.livros[0].capitulos[0], ['a', '', 'c']);
  assert.equal(b.livros.at(-1).nome, 'Livro Novo');
  assert.throws(() => lerBiblia('nada aqui', 'X.csv'), /Não encontrei versículos/);
  assert.throws(() => lerBiblia('{ quebrado', 'X.json'));
});

test('entende referências escritas', () => {
  assert.deepEqual(lerReferencia('jo 3:16'), { livro: 42, cap: 3, de: 16, ate: null });
  assert.deepEqual(lerReferencia('1 co 13.4-7'), { livro: 45, cap: 13, de: 4, ate: 7 });
  assert.deepEqual(lerReferencia('Salmos 23'), { livro: 18, cap: 23, de: null, ate: null });
  for (const ruim of ['amor', 'jo', 'xyz 3:16', '']) assert.equal(lerReferencia(ruim), null, ruim);
});

test('resolve referência e busca por palavras (sem acento e sem diferenciar maiúscula)', () => {
  const dados = lerBiblia(`Gênesis;1;1;${V.g11}\nJoão;3;16;${V.jo316}\nJoão;3;17;${V.jo317}\n`, 'ARC.csv');
  const biblia = new Biblia(dados);
  assert.deepEqual(biblia.resolver('jo 3:16-17'), { indiceLivro: 1, cap: 3, de: 16, ate: 17 });
  assert.equal(biblia.resolver('mt 1:1'), null); // livro que o arquivo não tem
  assert.equal(biblia.resolver('jo 9'), null);   // capítulo que não existe
  assert.deepEqual(biblia.buscar('AMOR prova').map((r) => [r.livro, r.cap, r.verso]), [['João', 3, 16]]);
  assert.equal(biblia.buscar('teste').length, 2);
  assert.deepEqual(biblia.buscar('a'), []); // palavra curta demais
  assert.equal(biblia.capitulo(1, 3).versiculos.length, 17);
});

test('pasta das Bíblias: lê os arquivos, avisa dos que não consegue ler e percebe arquivo novo', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-biblias-'));
  try {
    await writeFile(path.join(pasta, 'ARC.csv'), `Gênesis;1;1;${V.g11}\n`);
    await writeFile(path.join(pasta, 'quebrada.json'), '{ nao e json');
    await writeFile(path.join(pasta, 'leia-me.docx'), 'ignorado');
    const biblias = new PastaDeBiblias(path.join(pasta, 'Bíblias'));
    await biblias.iniciar();
    assert.deepEqual(biblias.lista(), []); // pasta nova e vazia
    await writeFile(path.join(pasta, 'Bíblias', 'ARC.csv'), `Gênesis;1;1;${V.g11}\n`);
    await writeFile(path.join(pasta, 'Bíblias', 'quebrada.json'), '{ nao e json');
    await biblias.verificar();
    assert.deepEqual(biblias.lista().map((v) => [v.id, v.versiculos]), [['ARC', 1]]);
    assert.equal(biblias.erros[0].arquivo, 'quebrada.json');
    await writeFile(path.join(pasta, 'Bíblias', 'NTLH.csv'), `João;3;16;${V.jo316}\n`);
    await biblias.verificar();
    assert.deepEqual(biblias.lista().map((v) => v.id), ['ARC', 'NTLH']);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
