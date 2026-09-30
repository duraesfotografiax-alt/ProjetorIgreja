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

const LIMITE_ARQUIVO = 200 * 1024 * 1024; // 200 MB por arquivo

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
  let apresentacoes = await biblioteca.listar();
  let estado = estadoInicial();

  const app = express();
  const servidor = http.createServer(app);
  const wss = new WebSocketServer({ server: servidor, path: '/ws' });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITE_ARQUIVO } });

  const pacote = () => JSON.stringify({ tipo: 'estado', estado, apresentacoes });
  const transmitir = () => {
    const msg = pacote();
    for (const cliente of wss.clients) if (cliente.readyState === 1) cliente.send(msg);
  };

  wss.on('connection', (socket) => {
    socket.send(pacote());
    socket.on('message', (dados) => {
      let comando;
      try { comando = JSON.parse(dados); } catch { return; }
      const novo = aplicarComando(estado, comando, apresentacoes);
      if (novo !== estado) { estado = novo; transmitir(); }
    });
  });

  app.get('/', (_req, res) => res.redirect('/controle.html'));
  app.use(express.static(pastaPublica));
  app.use('/midia', express.static(pastaBiblioteca, { maxAge: '1h' }));

  app.get('/api/conexao', async (_req, res) => {
    const url = `http://${enderecoNaRede()}:${servidor.address().port}/`;
    res.json({ url, qrcode: await QRCode.toDataURL(url, { margin: 1, width: 400 }) });
  });

  app.post('/api/enviar', upload.array('arquivos', 200), async (req, res) => {
    try {
      const arquivos = (req.files ?? []).map((f) => ({
        // O multer entrega o nome em latin1; converte para manter acentos.
        nomeOriginal: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        buffer: f.buffer,
      }));
      const criadas = await biblioteca.adicionar(arquivos);
      apresentacoes = await biblioteca.listar();
      transmitir();
      res.json({ criadas });
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.delete('/api/apresentacoes/:id', async (req, res) => {
    try {
      await biblioteca.remover(req.params.id);
      apresentacoes = await biblioteca.listar();
      estado = ajustarAposRemocao(estado, apresentacoes);
      transmitir();
      res.json({ ok: true });
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.use((erro, _req, res, _next) => {
    const mensagem = erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máximo 200 MB).' : erro.message;
    res.status(400).json({ erro: mensagem });
  });

  await new Promise((resolve) => servidor.listen(porta, resolve));
  return servidor;
}

export const PASTA_RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
