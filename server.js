import { spawn } from 'node:child_process';
import path from 'node:path';
import { criarServidor, enderecoNaRede, PASTA_RAIZ } from './src/servidor.js';

const porta = Number(process.env.PORTA) || 8080;
const abrirNavegador = process.argv.includes('--abrir');

// Com --abrir, já abre o telão no navegador padrão (usado pelos atalhos iniciar-*).
function abrirTelao() {
  const url = `http://localhost:${porta}/telao.html`;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

let servidor;
try {
  servidor = await criarServidor({
    pastaBiblioteca: path.join(PASTA_RAIZ, 'biblioteca'),
    pastaPublica: path.join(PASTA_RAIZ, 'public'),
    porta,
  });
} catch (erro) {
  if (erro.code !== 'EADDRINUSE') throw erro;
  console.log('');
  console.log('  O Projetor Igreja já está aberto em outra janela.');
  console.log(`  Telão: http://localhost:${porta}/telao.html`);
  if (abrirNavegador) abrirTelao();
  process.exit(0);
}

const endereco = `http://${enderecoNaRede()}:${servidor.address().port}`;
console.log('');
console.log('  Projetor Igreja está rodando!');
console.log('');
console.log(`  Telão (abra neste computador): http://localhost:${porta}/telao.html`);
console.log(`  Celular (mesmo Wi-Fi):         ${endereco}`);
console.log('');
console.log('  Para desligar, feche esta janela.');

if (abrirNavegador) abrirTelao();
