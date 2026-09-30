// Guarda as apresentações em pastas: biblioteca/<id>/001.jpg, 002.jpg, ... + info.json
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pdfParaJpegs, nomePagina } from './pdf.js';

const EXTENSOES_IMAGEM = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function tipoDoArquivo(nomeOriginal) {
  const ext = path.extname(nomeOriginal).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (EXTENSOES_IMAGEM.has(ext)) return 'imagem';
  return null;
}

// Gera um id legível e seguro para usar como nome de pasta.
export function criarId(nome, agora = new Date()) {
  const slug = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'apresentacao';
  const carimbo = agora.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${carimbo}-${slug}`;
}

export class Biblioteca {
  constructor(pasta) {
    this.pasta = pasta;
  }

  async listar() {
    await mkdir(this.pasta, { recursive: true });
    const entradas = await readdir(this.pasta, { withFileTypes: true });
    const lista = [];
    for (const e of entradas) {
      if (!e.isDirectory()) continue;
      try {
        lista.push(JSON.parse(await readFile(path.join(this.pasta, e.name, 'info.json'), 'utf8')));
      } catch {
        // Pasta sem info.json (envio interrompido): ignora.
      }
    }
    return lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  }

  // arquivos: [{ nomeOriginal, buffer }]. Um PDF vira uma apresentação;
  // várias imagens enviadas juntas viram uma apresentação, em ordem de nome.
  async adicionar(arquivos) {
    const validos = arquivos.filter((a) => tipoDoArquivo(a.nomeOriginal));
    if (validos.length === 0) throw new Error('Envie um PDF ou imagens (JPG, PNG).');

    const pdfs = validos.filter((a) => tipoDoArquivo(a.nomeOriginal) === 'pdf');
    const imagens = validos
      .filter((a) => tipoDoArquivo(a.nomeOriginal) === 'imagem')
      .sort((a, b) => a.nomeOriginal.localeCompare(b.nomeOriginal, 'pt-BR', { numeric: true }));

    const criadas = [];
    for (const pdf of pdfs) {
      criadas.push(await this.#criar(pdf.nomeOriginal, (pasta) => pdfParaJpegs(pdf.buffer, pasta)));
    }
    if (imagens.length > 0) {
      criadas.push(await this.#criar(imagens[0].nomeOriginal, async (pasta) => {
        const nomes = [];
        for (const [i, img] of imagens.entries()) {
          const nome = nomePagina(i + 1).replace('.jpg', path.extname(img.nomeOriginal).toLowerCase());
          await writeFile(path.join(pasta, nome), img.buffer);
          nomes.push(nome);
        }
        return nomes;
      }));
    }
    return criadas;
  }

  async remover(id) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Id inválido.');
    await rm(path.join(this.pasta, id), { recursive: true, force: true });
  }

  async #criar(nomeOriginal, gerarSlides) {
    const nome = path.basename(nomeOriginal, path.extname(nomeOriginal));
    const id = criarId(nome);
    const pasta = path.join(this.pasta, id);
    await mkdir(pasta, { recursive: true });
    try {
      const slides = await gerarSlides(pasta);
      const info = { id, nome, criadaEm: new Date().toISOString(), slides };
      await writeFile(path.join(pasta, 'info.json'), JSON.stringify(info, null, 2));
      return info;
    } catch (erro) {
      await rm(pasta, { recursive: true, force: true });
      throw erro;
    }
  }
}
