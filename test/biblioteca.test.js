import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Biblioteca, separarEstrofes, tipoDoArquivo } from '../src/biblioteca.js';

async function comPasta(fn) {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-bib-'));
  try { await fn(pasta); } finally { await rm(pasta, { recursive: true, force: true }); }
}

test('separa a letra em estrofes pelas linhas em branco', () => {
  const letra = 'Linha 1\r\nLinha 2\r\n\r\n\r\n  Refrão  \n\n   \n';
  assert.deepEqual(separarEstrofes(letra), ['Linha 1\nLinha 2', 'Refrão']);
  assert.deepEqual(separarEstrofes(''), []);
});

test('reconhece os tipos de arquivo', () => {
  assert.equal(tipoDoArquivo('culto.PDF'), 'pdf');
  assert.equal(tipoDoArquivo('foto.jpeg'), 'imagem');
  assert.equal(tipoDoArquivo('clipe.MP4'), 'video');
  assert.equal(tipoDoArquivo('nota.txt'), null);
});

test('cria, edita e apaga música', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  const musica = await bib.salvarMusica({ nome: 'Grande é o Senhor', artista: 'Ministério', letra: 'A\nB\n\nC' });
  assert.equal(musica.tipo, 'musica');
  assert.deepEqual(musica.estrofes, ['A\nB', 'C']);

  const editada = await bib.salvarMusica({ id: musica.id, nome: 'Grande é o Senhor', letra: 'X\n\nY\n\nZ' });
  assert.equal(editada.id, musica.id);
  assert.deepEqual(editada.estrofes, ['X', 'Y', 'Z']);
  assert.equal((await bib.listar()).length, 1);

  await bib.remover(musica.id);
  assert.equal((await bib.listar()).length, 0);
}));

test('música sem nome ou sem letra é recusada', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  await assert.rejects(bib.salvarMusica({ nome: ' ', letra: 'A' }), /nome/);
  await assert.rejects(bib.salvarMusica({ nome: 'X', letra: '\n\n' }), /letra/);
}));

test('vídeo enviado vira item do tipo vídeo', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  const temporario = path.join(pasta, 'upload-temp');
  await writeFile(temporario, 'conteudo do video');
  const [video] = await bib.adicionar([{ nomeOriginal: 'Clipe Missões.MP4', caminho: temporario }]);
  assert.equal(video.tipo, 'video');
  assert.equal(video.nome, 'Clipe Missões');
  assert.deepEqual(await readdir(path.join(pasta, video.id)), ['info.json', 'video.mp4']);
}));

test('imagens enviadas juntas viram uma apresentação em ordem de nome', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  const arquivos = [];
  for (const nome of ['slide 10.png', 'slide 2.png', 'slide 1.png']) {
    const caminho = path.join(pasta, `tmp-${nome}`);
    await writeFile(caminho, nome);
    arquivos.push({ nomeOriginal: nome, caminho });
  }
  const [ap] = await bib.adicionar(arquivos);
  assert.deepEqual(ap.slides, ['001.png', '002.png', '003.png']);
}));

test('ignora pastas sem info.json e itens antigos viram slides', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  await writeFile(path.join(pasta, 'culto.json'), '[]');
  await mkdir(path.join(pasta, 'quebrado'));
  await mkdir(path.join(pasta, 'antigo'));
  await writeFile(path.join(pasta, 'antigo', 'info.json'),
    JSON.stringify({ id: 'antigo', nome: 'Antigo', criadaEm: '2026-01-01', slides: ['001.jpg'] }));
  const lista = await bib.listar();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tipo, 'slides');
}));

test('copia alguns slides para uma apresentação nova, sem mexer na original', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(pasta);
  const arquivos = [];
  for (const nome of ['1.png', '2.png', '3.png']) {
    const caminho = path.join(pasta, `tmp-${nome}`);
    await writeFile(caminho, `conteudo ${nome}`);
    arquivos.push({ nomeOriginal: nome, caminho });
  }
  const [original] = await bib.adicionar(arquivos);
  const copia = await bib.copiarSlides(original.id, [2, 0, 2, 99]);
  assert.equal(copia.nome, '1 (slides 1, 3)');
  assert.deepEqual(copia.slides, ['001.png', '002.png']);
  assert.equal(await readFile(path.join(pasta, copia.id, '002.png'), 'utf8'), 'conteudo 3.png');
  assert.equal((await bib.listar()).length, 2);
  await assert.rejects(bib.copiarSlides(original.id, []), /pelo menos um/);
}));

test('copiar arquivos (pastas dos dias) mantém o original', () => comPasta(async (pasta) => {
  const bib = new Biblioteca(path.join(pasta, 'bib'));
  const original = path.join(pasta, 'clipe.mp4');
  await writeFile(original, 'video');
  await bib.adicionar([{ nomeOriginal: 'clipe.mp4', caminho: original }], { copiar: true });
  assert.ok((await readdir(pasta)).includes('clipe.mp4'));
}));
