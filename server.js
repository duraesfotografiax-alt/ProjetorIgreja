import path from 'node:path';
import { criarServidor, enderecoNaRede, PASTA_RAIZ } from './src/servidor.js';
import { abrirTelao } from './src/abrir.js';

const porta = Number(process.env.PORTA) || 8080;
const abrirNavegador = process.argv.includes('--abrir');
const enderecoTelao = `http://localhost:${porta}/telao.html`;

let servidor;
try {
  servidor = await criarServidor({
    pastaBiblioteca: path.join(PASTA_RAIZ, 'biblioteca'),
    pastaPublica: path.join(PASTA_RAIZ, 'public'),
    pastaDias: path.join(PASTA_RAIZ, 'Pastas do Projetor'),
    porta,
  });
} catch (erro) {
  if (erro.code !== 'EADDRINUSE') throw erro;
  console.log('');
  console.log('  O Projetor já está aberto em outra janela.');
  console.log(`  Telão: ${enderecoTelao}`);
  if (abrirNavegador) abrirTelao(enderecoTelao);
  process.exit(0);
}

const endereco = `http://${enderecoNaRede()}:${servidor.address().port}`;
console.log('');
console.log('  Projetor Durães está rodando!');
console.log('');
console.log(`  Telão (neste computador):  ${enderecoTelao}`);
console.log(`  Celular (mesmo Wi-Fi):     ${endereco}`);
console.log(`  Pastas dos dias:           ${path.join(PASTA_RAIZ, 'Pastas do Projetor')}`);
console.log('');
console.log('  Deixe esta janela aberta (pode minimizar). Para desligar, feche esta janela.');

if (abrirNavegador) abrirTelao(enderecoTelao);
