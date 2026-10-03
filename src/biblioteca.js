// Guarda tudo o que pode ir para o telão, uma pasta por item: biblioteca/<id>/info.json
// Tipos: 'slides' (imagens numeradas 001.jpg...), 'video' e 'musica' (letra em estrofes).
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pdfParaJpegs, nomePagina } from './pdf.js';

const EXTENSOES = {
  '.pdf': 'pdf',
  '.jpg': 'imagem', '.jpeg': 'imagem', '.png': 'imagem', '.webp': 'imagem',
  '.mp4': 'video', '.m4v': 'video', '.webm': 'video', '.mov': 'video',
};

export function tipoDoArquivo(nomeOriginal) {
  return EXTENSOES[path.extname(nomeOriginal).toLowerCase()] ?? null;
}

// Gera um id legível e seguro para usar como nome de pasta.
export function criarId(nome, agora = new Date()) {
  const slug = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';
  const carimbo = agora.toISOString().replace(/[-:T.Z]/g, '').slice(0, 17);
  return `${carimbo}-${slug}`;
}

// Separa a letra em estrofes: cada bloco separado por linha em branco vira uma tela.
export function separarEstrofes(letra) {
  return String(letra ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((bloco) => bloco.split('\n').map((l) => l.trim()).filter(Boolean).join('\n'))
    .filter(Boolean);
}

// Quantas telas o item tem (usado para avançar e voltar).
export function totalPartes(item) {
  if (item.tipo === 'musica') return item.estrofes.length;
  if (item.tipo === 'video') return 1;
  return item.slides.length;
}

const idValido = (id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id);

// Move o arquivo enviado (fica numa pasta temporária) para a biblioteca.
async function mover(origem, destino) {
  try {
    await rename(origem, destino);
  } catch {
    await copyFile(origem, destino); // pastas em discos diferentes
    await rm(origem, { force: true });
  }
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
        const item = JSON.parse(await readFile(path.join(this.pasta, e.name, 'info.json'), 'utf8'));
        lista.push({ tipo: 'slides', ...item }); // itens antigos não tinham tipo
      } catch {
        // Pasta sem info.json (envio interrompido): ignora.
      }
    }
    return lista.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  }

  // arquivos: [{ nomeOriginal, caminho }]. Cada PDF e cada vídeo vira um item;
  // várias imagens enviadas juntas viram uma apresentação, em ordem de nome.
  async adicionar(arquivos) {
    const porTipo = (t) => arquivos.filter((a) => tipoDoArquivo(a.nomeOriginal) === t);
    const pdfs = porTipo('pdf');
    const videos = porTipo('video');
    const imagens = porTipo('imagem')
      .sort((a, b) => a.nomeOriginal.localeCompare(b.nomeOriginal, 'pt-BR', { numeric: true }));
    if (pdfs.length + videos.length + imagens.length === 0) {
      throw new Error('Envie um PDF, imagens (JPG, PNG) ou vídeos (MP4).');
    }

    const criados = [];
    for (const pdf of pdfs) {
      criados.push(await this.#criar('slides', pdf.nomeOriginal, async (pasta) => ({
        slides: await pdfParaJpegs(await readFile(pdf.caminho), pasta),
      })));
    }
    if (imagens.length > 0) {
      criados.push(await this.#criar('slides', imagens[0].nomeOriginal, async (pasta) => {
        const slides = [];
        for (const [i, img] of imagens.entries()) {
          const nome = nomePagina(i + 1).replace('.jpg', path.extname(img.nomeOriginal).toLowerCase());
          await mover(img.caminho, path.join(pasta, nome));
          slides.push(nome);
        }
        return { slides };
      }));
    }
    for (const video of videos) {
      criados.push(await this.#criar('video', video.nomeOriginal, async (pasta) => {
        const arquivo = `video${path.extname(video.nomeOriginal).toLowerCase()}`;
        await mover(video.caminho, path.join(pasta, arquivo));
        return { arquivo };
      }));
    }
    return criados;
  }

  // Cria ou atualiza uma música. A letra é separada em estrofes por linhas em branco.
  async salvarMusica({ id, nome, artista, letra }) {
    const titulo = String(nome ?? '').trim();
    const estrofes = separarEstrofes(letra);
    if (!titulo) throw new Error('Dê um nome para a música.');
    if (estrofes.length === 0) throw new Error('Escreva a letra da música.');
    const dados = { artista: String(artista ?? '').trim(), letra: String(letra).replace(/\r\n?/g, '\n'), estrofes };

    if (id) {
      if (!idValido(id)) throw new Error('Id inválido.');
      const arquivo = path.join(this.pasta, id, 'info.json');
      const atual = JSON.parse(await readFile(arquivo, 'utf8'));
      if (atual.tipo !== 'musica') throw new Error('Este item não é uma música.');
      const item = { ...atual, nome: titulo, ...dados };
      await writeFile(arquivo, JSON.stringify(item, null, 2));
      return item;
    }
    return this.#criar('musica', titulo, async () => dados);
  }

  async remover(id) {
    if (!idValido(id)) throw new Error('Id inválido.');
    await rm(path.join(this.pasta, id), { recursive: true, force: true });
  }

  async #criar(tipo, nomeOriginal, preencher) {
    const nome = tipo === 'musica' ? nomeOriginal : path.basename(nomeOriginal, path.extname(nomeOriginal));
    const id = criarId(nome);
    const pasta = path.join(this.pasta, id);
    await mkdir(pasta, { recursive: true });
    try {
      const item = { id, tipo, nome, criadaEm: new Date().toISOString(), ...(await preencher(pasta)) };
      await writeFile(path.join(pasta, 'info.json'), JSON.stringify(item, null, 2));
      return item;
    } catch (erro) {
      await rm(pasta, { recursive: true, force: true });
      throw erro;
    }
  }
}
