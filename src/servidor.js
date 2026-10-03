import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';
import { Biblioteca } from './biblioteca.js';
import { estadoInicial, aplicarComando, ajustarAposRemocao } from './estado.js';

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

export async function criarServidor({ pastaBiblioteca, pastaPublica, porta }) {
  const biblioteca = new Biblioteca(pastaBiblioteca);
  const arquivoCulto = path.join(pastaBiblioteca, 'culto.json');
  let itens = await biblioteca.listar();
  let estado = ajustarAposRemocao(estadoInicial(await lerCulto(arquivoCulto)), itens);

  const app = express();
  const servidor = http.createServer(app);
  const wss = new WebSocketServer({ server: servidor, path: '/ws' });
  wss.on('error', () => {}); // erros de porta já chegam pelo servidor HTTP

  // Arquivos enviados vão primeiro para uma pasta temporária no disco (vídeos são grandes).
  const pastaEnvios = path.join(os.tmpdir(), 'projetor-igreja-envios');
  await mkdir(pastaEnvios, { recursive: true });
  const upload = multer({ dest: pastaEnvios, limits: { fileSize: LIMITE_ARQUIVO } });

  const pacote = () => JSON.stringify({ tipo: 'estado', estado, itens });
  const transmitir = () => {
    const msg = pacote();
    for (const cliente of wss.clients) if (cliente.readyState === 1) cliente.send(msg);
  };
  const mudarEstado = (novo) => {
    if (novo === estado) return;
    if (novo.culto !== estado.culto) writeFile(arquivoCulto, JSON.stringify(novo.culto)).catch(() => {});
    estado = novo;
    transmitir();
  };
  const recarregar = async () => {
    itens = await biblioteca.listar();
    const novo = ajustarAposRemocao(estado, itens);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
  };

  wss.on('connection', (socket) => {
    socket.send(pacote());
    socket.on('message', (dados) => {
      let comando;
      try { comando = JSON.parse(dados); } catch { return; }
      mudarEstado(aplicarComando(estado, comando, itens));
    });
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
      await recarregar();
      return { criados };
    } finally {
      await Promise.all(arquivos.map((a) => rm(a.caminho, { force: true })));
    }
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
  return servidor;
}

async function lerCulto(arquivo) {
  try {
    const lista = JSON.parse(await readFile(arquivo, 'utf8'));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export const PASTA_RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
