// Converte cada página de um PDF em JPEG numerado (001.jpg, 002.jpg, ...).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

// Largura alvo das imagens: Full HD é suficiente para qualquer telão comum.
const LARGURA_ALVO = 1920;

export function nomePagina(numero) {
  return `${String(numero).padStart(3, '0')}.jpg`;
}

export async function pdfParaJpegs(bufferPdf, pastaDestino) {
  const tarefa = getDocument({
    data: new Uint8Array(bufferPdf),
    isEvalSupported: false,
    verbosity: 0,
  });
  const documento = await tarefa.promise;

  const arquivos = [];
  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: LARGURA_ALVO / base.width });

      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, canvas, viewport }).promise;

      const nome = nomePagina(n);
      await writeFile(path.join(pastaDestino, nome), await canvas.encode('jpeg', 90));
      arquivos.push(nome);
      pagina.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
  return arquivos;
}
