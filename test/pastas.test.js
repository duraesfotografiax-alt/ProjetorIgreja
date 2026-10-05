import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Biblioteca } from '../src/biblioteca.js';
import { PastasDosDias, NOMES_PASTAS } from '../src/pastas.js';
import { criarPdf } from './util.js';

async function preparar() {
  const base = await mkdtemp(path.join(tmpdir(), 'projetor-pastas-'));
  const biblioteca = new Biblioteca(path.join(base, 'biblioteca'));
  const importacoes = [];
  const pastas = new PastasDosDias({
    raiz: path.join(base, 'pastas'),
    biblioteca,
    aoImportar: (dia, criados) => importacoes.push({ dia, nomes: criados.map((c) => c.nome) }),
    registrar: () => {},
  });
  await pastas.iniciar(60_000); // as verificações são chamadas na mão no teste
  return { base, biblioteca, pastas, importacoes, raiz: path.join(base, 'pastas') };
}

test('cria as pastas de segunda a domingo e a geral', async () => {
  const { base, pastas, raiz } = await preparar();
  try {
    assert.deepEqual((await readdir(raiz)).sort(), Object.values(NOMES_PASTAS).sort());
  } finally {
    pastas.parar();
    await rm(base, { recursive: true, force: true });
  }
});

test('PDF colocado na pasta de quarta vira slides na lista de quarta, uma vez só', async () => {
  const { base, biblioteca, pastas, importacoes, raiz } = await preparar();
  try {
    const original = path.join(raiz, NOMES_PASTAS.qua, 'Avisos.pdf');
    await writeFile(original, criarPdf(['A', 'B']));
    await writeFile(path.join(raiz, NOMES_PASTAS.qua, 'anotacoes.txt'), 'ignorado');
    await writeFile(path.join(raiz, NOMES_PASTAS.qua, 'video.mp4.crdownload'), 'baixando');

    await pastas.verificar(); // primeira vez: só anota (pode estar sendo copiado)
    assert.equal(importacoes.length, 0);
    await pastas.verificar(); // tamanho igual: importa
    assert.deepEqual(importacoes, [{ dia: 'qua', nomes: ['Avisos'] }]);
    await pastas.verificar(); // não importa de novo
    assert.equal(importacoes.length, 1);

    const [item] = await biblioteca.listar();
    assert.deepEqual(item.slides, ['001.jpg', '002.jpg']);
    await access(original); // o original continua na pasta
  } finally {
    pastas.parar();
    await rm(base, { recursive: true, force: true });
  }
});

test('lembra o que já importou mesmo depois de reiniciar', async () => {
  const primeira = await preparar();
  try {
    await writeFile(path.join(primeira.raiz, NOMES_PASTAS[''], 'Logo.png'), 'imagem');
    await primeira.pastas.verificar();
    await primeira.pastas.verificar();
    assert.deepEqual(primeira.importacoes, [{ dia: '', nomes: ['Logo'] }]);
    primeira.pastas.parar();

    const importacoes = [];
    const nova = new PastasDosDias({
      raiz: primeira.raiz, biblioteca: primeira.biblioteca, registrar: () => {},
      aoImportar: (dia) => importacoes.push(dia),
    });
    await nova.iniciar(60_000);
    await nova.verificar();
    await nova.verificar();
    nova.parar();
    assert.equal(importacoes.length, 0);
  } finally {
    await rm(primeira.base, { recursive: true, force: true });
  }
});

test('arquivo com problema é avisado e não trava as próximas verificações', async () => {
  const { base, pastas, importacoes, raiz } = await preparar();
  try {
    await writeFile(path.join(raiz, NOMES_PASTAS.sex, 'quebrado.pdf'), 'isto não é um pdf');
    await pastas.verificar();
    await pastas.verificar();
    assert.equal(importacoes.length, 0);
    await writeFile(path.join(raiz, NOMES_PASTAS.sex, 'bom.pdf'), criarPdf(['ok']));
    await pastas.verificar();
    await pastas.verificar();
    assert.deepEqual(importacoes, [{ dia: 'sex', nomes: ['bom'] }]);
  } finally {
    pastas.parar();
    await rm(base, { recursive: true, force: true });
  }
});
