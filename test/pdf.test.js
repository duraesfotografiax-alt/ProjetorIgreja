import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pdfParaJpegs, nomePagina } from '../src/pdf.js';
import { criarPdf } from './util.js';

test('nomePagina numera com três dígitos', () => {
  assert.equal(nomePagina(1), '001.jpg');
  assert.equal(nomePagina(42), '042.jpg');
});

test('converte cada página do PDF em JPEG numerado, na ordem', async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'projetor-'));
  try {
    const arquivos = await pdfParaJpegs(criarPdf(['Slide 1', 'Slide 2', 'Slide 3']), pasta);
    assert.deepEqual(arquivos, ['001.jpg', '002.jpg', '003.jpg']);
    assert.deepEqual((await readdir(pasta)).sort(), arquivos);

    const jpeg = await readFile(path.join(pasta, '001.jpg'));
    assert.equal(jpeg[0], 0xff); // assinatura JPEG
    assert.equal(jpeg[1], 0xd8);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
