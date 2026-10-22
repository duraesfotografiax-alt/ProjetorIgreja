import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';
import { Biblioteca } from './biblioteca.js';
import { PastasDosDias } from './pastas.js';
import { lerLinkYoutube, tituloYoutube } from './youtube.js';
import { estadoInicial, aplicarComando, ajustarAposRemocao, adicionarAoDia, diaDaSemana } from './estado.js';

const LIMITE_ARQUIVO = 4 * 1024 * 1024 * 1024; // 4 GB por arquivo (vídeos)

// Endereço do computador na rede Wi-Fi, para o celular conseguir acessar.
export function enderecoNaRede() {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista ?? []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

export async function criarServidor({ pastaBiblioteca, pastaPublica, porta, pastaDias, intervaloPastas }) {
  const biblioteca = new Biblioteca(pastaBiblioteca);
  const arquivoCultos = path.join(pastaBiblioteca, 'cultos.json');
  let itens = await biblioteca.listar();
  let estado = ajustarAposRemocao(estadoInicial(await lerCultos(pastaBiblioteca)), itens);

  const app = express();
  const servidor = http.createServer(app);
  const wss = new WebSocketServer({ server: servidor, path: '/ws' });
  wss.on('error', () => {}); // erros de porta já chegam pelo servidor HTTP

  // Arquivos enviados vão primeiro para uma pasta temporária no disco (vídeos são grandes).
  const pastaEnvios = path.join(os.tmpdir(), 'projetor-igreja-envios');
  await mkdir(pastaEnvios, { recursive: true });
  const upload = multer({ dest: pastaEnvios, limits: { fileSize: LIMITE_ARQUIVO } });

  // Quantos celulares estão conectados (o telão esconde o QR code quando há algum).
  const controles = () => [...wss.clients].filter((c) => c.papel === 'controle' && c.readyState === 1).length;
  const pacote = () => JSON.stringify({ tipo: 'estado', estado, itens, controles: controles() });
  const transmitir = () => {
    const msg = pacote();
    for (const cliente of wss.clients) if (cliente.readyState === 1) cliente.send(msg);
  };
  const mudarEstado = (novo) => {
    if (novo === estado) return;
    if (novo.cultos !== estado.cultos) writeFile(arquivoCultos, JSON.stringify(novo.cultos, null, 2)).catch(() => {});
    estado = novo;
    transmitir();
  };
  const recarregar = async () => {
    itens = await biblioteca.listar();
    const novo = ajustarAposRemocao(estado, itens);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
  };

  // Quando vira o dia (programa aberto de um dia para o outro), muda a lista de hoje.
  const relogio = setInterval(() => {
    const hoje = diaDaSemana();
    if (hoje !== estado.hoje) mudarEstado({ ...estado, hoje });
  }, 60_000);
  relogio.unref();
  servidor.on('close', () => clearInterval(relogio));

  wss.on('connection', (socket) => {
    socket.send(pacote());
    socket.on('message', (dados) => {
      let comando;
      try { comando = JSON.parse(dados); } catch { return; }
      if (comando?.acao === 'ola') {
        socket.papel = comando.papel === 'telao' ? 'telao' : 'controle';
        transmitir();
        return;
      }
      mudarEstado(aplicarComando(estado, comando, itens));
    });
    socket.on('close', () => { if (socket.papel === 'controle') transmitir(); });
  });

  app.get('/', (_req, res) => res.redirect('/controle.html'));
  app.use(express.static(pastaPublica));
  app.use('/midia', express.static(pastaBiblioteca, { maxAge: '1h' }));
  app.use(express.json({ limit: '1mb' }));

  // Erros das rotas viram uma mensagem simples para mostrar no celular.
  const rota = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  };

  app.get('/api/conexao', rota(async () => {
    const url = `http://${enderecoNaRede()}:${servidor.address().port}/`;
    return { url, qrcode: await QRCode.toDataURL(url, { margin: 1, width: 400 }) };
  }));

  app.post('/api/enviar', upload.array('arquivos', 200), rota(async (req) => {
    const arquivos = (req.files ?? []).map((f) => ({
      // O multer entrega o nome em latin1; converte para manter acentos.
      nomeOriginal: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      caminho: f.path,
    }));
    try {
      const criados = await biblioteca.adicionar(arquivos);
      itens = await biblioteca.listar();
      // Se o celular escolheu um dia, os itens já entram na lista daquele dia.
      const novo = adicionarAoDia(estado, req.body?.dia, criados.map((c) => c.id));
      if (novo !== estado) mudarEstado(novo);
      else transmitir();
      return { criados };
    } finally {
      await Promise.all(arquivos.map((a) => rm(a.caminho, { force: true })));
    }
  }));

  // Copia alguns slides para uma apresentação nova e já coloca nos dias escolhidos.
  app.post('/api/itens/:id/copiar', rota(async (req) => {
    const copia = await biblioteca.copiarSlides(req.params.id, req.body?.slides ?? []);
    itens = await biblioteca.listar();
    let novo = estado;
    for (const dia of req.body?.dias ?? []) novo = adicionarAoDia(novo, dia, [copia.id]);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
    return { copia };
  }));

  // Abre a janela das pastas dos dias no computador (Explorador de Arquivos / Finder).
  app.post('/api/abrir-pastas', rota(async () => {
    if (!pastaDias) throw new Error('Pastas dos dias desligadas.');
    const [cmd, args] = process.platform === 'win32' ? ['explorer', [pastaDias]]
      : process.platform === 'darwin' ? ['open', [pastaDias]] : ['xdg-open', [pastaDias]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    return { ok: true };
  }));

  // Fundo da tela: a imagem mais recente da pasta "9 - Fundo da tela" (ou nenhuma).
  const pastaFundo = pastaDias ? path.join(pastaDias, '9 - Fundo da tela') : null;
  if (pastaFundo) {
    await mkdir(pastaFundo, { recursive: true });
    app.use('/fundo-da-tela', express.static(pastaFundo));
  }
  app.get('/api/fundo', rota(async () => {
    if (!pastaFundo) return { url: null };
    let maisRecente = null;
    for (const nome of await readdir(pastaFundo)) {
      if (!/\.(jpe?g|png|webp)$/i.test(nome)) continue;
      const { mtimeMs } = await stat(path.join(pastaFundo, nome));
      if (!maisRecente || mtimeMs > maisRecente.mtimeMs) maisRecente = { nome, mtimeMs };
    }
    return { url: maisRecente ? `/fundo-da-tela/${encodeURIComponent(maisRecente.nome)}?v=${Math.round(maisRecente.mtimeMs)}` : null };
  }));

  // Link do YouTube colado no celular: vira item (e entra no dia escolhido, se houver).
  app.post('/api/youtube', rota(async (req) => {
    const link = String(req.body?.link ?? '').trim();
    const lido = lerLinkYoutube(link);
    if (!lido) throw new Error('Não reconheci esse link. Use o link do vídeo ou da transmissão (ex.: youtube.com/live/...).');
    const nome = req.body?.nome || await tituloYoutube(link);
    const item = await biblioteca.salvarYoutube({ link, nome, ...lido });
    itens = await biblioteca.listar();
    const novo = adicionarAoDia(estado, req.body?.dia, [item.id]);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
    return { item };
  }));

  app.post('/api/musicas', rota(async (req) => {
    const musica = await biblioteca.salvarMusica({ ...req.body, id: undefined });
    await recarregar();
    return { musica };
  }));

  app.put('/api/musicas/:id', rota(async (req) => {
    const musica = await biblioteca.salvarMusica({ ...req.body, id: req.params.id });
    await recarregar();
    return { musica };
  }));

  app.delete('/api/itens/:id', rota(async (req) => {
    await biblioteca.remover(req.params.id);
    await recarregar();
    return { ok: true };
  }));

  app.use((erro, _req, res, _next) => {
    const mensagem = erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máximo 4 GB).' : erro.message;
    res.status(400).json({ erro: mensagem });
  });

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(porta, resolve);
  });

  // Pastas dos dias no computador (opcional): arquivos colocados nelas entram sozinhos.
  if (pastaDias) {
    const pastas = new PastasDosDias({
      raiz: pastaDias,
      biblioteca,
      aoImportar: async (dia, criados) => {
        itens = await biblioteca.listar();
        const novo = adicionarAoDia(estado, dia, criados.map((c) => c.id));
        if (novo !== estado) mudarEstado(novo);
        else transmitir();
      },
    });
    await pastas.iniciar(intervaloPastas);
    servidor.on('close', () => pastas.parar());
  }
  return servidor;
}

// Lê as listas de cada dia. A versão anterior tinha uma lista só (culto.json):
// ela vira a lista de hoje.
async function lerCultos(pasta) {
  try {
    return JSON.parse(await readFile(path.join(pasta, 'cultos.json'), 'utf8'));
  } catch {
    try {
      const antiga = JSON.parse(await readFile(path.join(pasta, 'culto.json'), 'utf8'));
      return Array.isArray(antiga) ? { [diaDaSemana()]: antiga } : {};
    } catch {
      return {};
    }
  }
}

export const PASTA_RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
