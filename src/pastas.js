// Pastas dos dias no computador: o que for colocado em "Pastas do Projetor/3 - Quarta",
// por exemplo, aparece sozinho no programa, já convertido e na lista de quarta.
// O arquivo original continua na pasta.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tipoDoArquivo } from './biblioteca.js';

export const NOMES_PASTAS = {
  seg: '1 - Segunda', ter: '2 - Terça', qua: '3 - Quarta', qui: '4 - Quinta',
  sex: '5 - Sexta', sab: '6 - Sábado', dom: '7 - Domingo', '': '0 - Geral (sem dia)',
};

// Arquivos que ainda estão sendo copiados ou baixados, ou de sistema.
const ignorar = (nome) => nome.startsWith('.') || nome.startsWith('~$')
  || /\.(crdownload|part|tmp|download)$/i.test(nome);

export class PastasDosDias {
  // aoImportar(dia, itensCriados) é chamado depois de cada importação.
  constructor({ raiz, biblioteca, aoImportar, registrar = console.log }) {
    this.raiz = raiz;
    this.biblioteca = biblioteca;
    this.aoImportar = aoImportar;
    this.registrar = registrar;
    this.arquivoIndice = path.join(raiz, '.importados.json');
    this.importados = new Set();
    this.vistos = new Map(); // arquivo -> assinatura da última verificação
    this.ocupado = false;
  }

  async iniciar(intervalo = 3000) {
    for (const nome of Object.values(NOMES_PASTAS)) await mkdir(path.join(this.raiz, nome), { recursive: true });
    try {
      this.importados = new Set(JSON.parse(await readFile(this.arquivoIndice, 'utf8')));
    } catch {
      this.importados = new Set();
    }
    this.timer = setInterval(() => this.verificar().catch((e) => this.registrar(`Erro nas pastas: ${e.message}`)), intervalo);
    this.timer.unref();
  }

  parar() {
    clearInterval(this.timer);
  }

  // Procura arquivos novos. Um arquivo só é importado quando o tamanho para de mudar
  // entre duas verificações (para não pegar um vídeo ainda sendo copiado).
  async verificar() {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      for (const [dia, nomePasta] of Object.entries(NOMES_PASTAS)) {
        const pasta = path.join(this.raiz, nomePasta);
        let entradas;
        try { entradas = await readdir(pasta, { withFileTypes: true }); } catch { continue; }

        const prontos = [];
        for (const e of entradas) {
          if (!e.isFile() || ignorar(e.name) || !tipoDoArquivo(e.name)) continue;
          const caminho = path.join(pasta, e.name);
          let info;
          try { info = await stat(caminho); } catch { continue; }
          const assinatura = `${nomePasta}/${e.name}:${info.size}:${Math.round(info.mtimeMs)}`;
          if (this.importados.has(assinatura)) continue;
          if (this.vistos.get(caminho) === assinatura) prontos.push({ nomeOriginal: e.name, caminho, assinatura });
          else this.vistos.set(caminho, assinatura);
        }
        if (prontos.length > 0) await this.#importar(dia, nomePasta, prontos);
      }
    } finally {
      this.ocupado = false;
    }
  }

  async #importar(dia, nomePasta, arquivos) {
    let criados = [];
    try {
      criados = await this.biblioteca.adicionar(arquivos, { copiar: true });
      this.registrar(`Pasta "${nomePasta}": ${arquivos.map((a) => a.nomeOriginal).join(', ')} importado(s).`);
    } catch (erro) {
      // Arquivo com problema (PDF corrompido, por exemplo): avisa e não tenta de novo.
      this.registrar(`Pasta "${nomePasta}": não foi possível importar (${erro.message}).`);
    }
    for (const a of arquivos) {
      this.importados.add(a.assinatura);
      this.vistos.delete(a.caminho);
    }
    await writeFile(this.arquivoIndice, JSON.stringify([...this.importados], null, 1));
    if (criados.length > 0) await this.aoImportar(dia, criados);
  }
}
