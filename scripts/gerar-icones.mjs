// Gera os ícones do controle (tela inicial do celular). Rode: node scripts/gerar-icones.mjs
import { writeFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const simbolo = await loadImage('public/logo-duraes.png');

function desenhar(tamanho, { margem = 0 } = {}) {
  const c = createCanvas(tamanho, tamanho);
  const x = c.getContext('2d');
  // fundo preto quente com um brilho leve
  const g = x.createRadialGradient(tamanho / 2, tamanho * 0.4, 0, tamanho / 2, tamanho / 2, tamanho * 0.75);
  g.addColorStop(0, '#2a211b');
  g.addColorStop(1, '#0d0a08');
  x.fillStyle = g;
  x.fillRect(0, 0, tamanho, tamanho);
  // símbolo centralizado (coroa, D com play laranja e estrelas)
  const altura = tamanho * (0.74 - margem / 100 * 1.6);
  const largura = altura * simbolo.width / simbolo.height;
  x.drawImage(simbolo, (tamanho - largura) / 2, (tamanho - altura) / 2, largura, altura);
  // faixa dourada discreta na base
  const f = x.createLinearGradient(0, 0, tamanho, 0);
  for (const [p, cor] of [[0, '#c43b07'], [0.25, '#d9702c'], [0.5, '#f3b757'], [0.75, '#e99d49'], [1, '#c23603']]) f.addColorStop(p, cor);
  x.fillStyle = f;
  x.fillRect(0, tamanho * 0.95, tamanho, tamanho * 0.05);
  return c.encode('png');
}

await writeFile('public/icones/icone-192.png', await desenhar(192));
await writeFile('public/icones/icone-512.png', await desenhar(512));
await writeFile('public/icones/icone-mascara-512.png', await desenhar(512, { margem: 10 }));
await writeFile('public/icones/apple-touch-icon.png', await desenhar(180));
console.log('Ícones gerados em public/icones');
