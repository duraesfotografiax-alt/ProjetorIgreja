// Gera os ícones do controle (tela inicial do celular). Rode: node scripts/gerar-icones.mjs
import { writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';

function desenhar(tamanho, { margem = 0 } = {}) {
  const c = createCanvas(tamanho, tamanho);
  const x = c.getContext('2d');
  const s = tamanho / 100;
  // fundo azul escuro
  const g = x.createLinearGradient(0, 0, tamanho, tamanho);
  g.addColorStop(0, '#1b2a55');
  g.addColorStop(1, '#0b1020');
  x.fillStyle = g;
  x.fillRect(0, 0, tamanho, tamanho);
  // telão (retângulo 16:9) com o play laranja
  const area = 100 - margem * 2;
  const largura = area * 0.62, altura = largura * 9 / 16;
  const left = 50 - largura / 2, top = 46 - altura / 2;
  x.lineWidth = 4.5 * s;
  x.strokeStyle = '#f1f1f3';
  x.beginPath(); x.roundRect(left * s, top * s, largura * s, altura * s, 5 * s); x.stroke();
  x.fillStyle = '#eb5b02';
  const t = altura * 0.42;
  x.beginPath();
  x.moveTo((50 - t * 0.38) * s, (46 - t / 2) * s);
  x.lineTo((50 + t * 0.52) * s, 46 * s);
  x.lineTo((50 - t * 0.38) * s, (46 + t / 2) * s);
  x.closePath(); x.fill();
  // pezinho do telão
  x.fillStyle = '#f1f1f3';
  x.fillRect((50 - largura * 0.22) * s, (top + altura + 6) * s, largura * 0.44 * s, 4 * s);
  return c.encode('png');
}

await writeFile('public/icones/icone-192.png', await desenhar(192));
await writeFile('public/icones/icone-512.png', await desenhar(512));
await writeFile('public/icones/icone-mascara-512.png', await desenhar(512, { margem: 10 }));
await writeFile('public/icones/apple-touch-icon.png', await desenhar(180));
console.log('Ícones gerados em public/icones');
