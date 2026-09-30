import { spawn } from 'node:child_process';
import path from 'node:path';
import { criarServidor, enderecoNaRede, PASTA_RAIZ } from './src/servidor.js';

const porta = Number(process.env.PORTA) || 8080;

const servidor = await criarServidor({
  pastaBiblioteca: path.join(PASTA_RAIZ, 'biblioteca'),
  pastaPublica: path.join(PASTA_RAIZ, 'public'),
  porta,
});

const endereco = `http://${enderecoNaRede()}:${servidor.address().port}`;
console.log('');
console.log('  Projetor Igreja está rodando!');
console.log('');
console.log(`  Telão (abra neste computador): http://localhost:${porta}/telao.html`);
console.log(`  Celular (mesmo Wi-Fi):         ${endereco}`);
console.log('');
console.log('  Para desligar, feche esta janela.');

// Com --abrir, já abre o telão no navegador padrão (usado pelos atalhos iniciar-*).
if (process.argv.includes('--abrir')) {
  const url = `http://localhost:${porta}/telao.html`;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}
