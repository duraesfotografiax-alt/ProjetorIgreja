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
import { lerLinkSite, tituloSite } from './site.js';
import { abrirLink as abrirLinkReal, abrirPasta } from './abrir.js';
import { JanelaSite } from './navegador.js';
import { PastaDeBiblias, lerBiblia } from './biblia.js';
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

// Item fixo (não é arquivo): mostra no telão uma aba ou janela do computador.
const ITEM_TELA = { id: 'tela', tipo: 'tela', nome: 'Tela do computador', criadaEm: '' };

export async function criarServidor({
  pastaBiblioteca, pastaPublica, porta, pastaDias, intervaloPastas, pastaNavegador,
  pastaBiblias = pastaDias && path.join(pastaDias, '8 - Bíblias'),
  abrirLink = abrirLinkReal, registrar = () => {},
  janelaSite = new JanelaSite({ perfil: pastaNavegador && path.join(pastaNavegador, 'site'), registrar }),
}) {
  const biblioteca = new Biblioteca(pastaBiblioteca);
  const arquivoCultos = path.join(pastaBiblioteca, 'cultos.json');
  // Versículo no ar: item temporário com o capítulo aberto (não é arquivo, não fica salvo).
  let itemBiblia = null;
  const listarTudo = async () => [ITEM_TELA, ...(itemBiblia ? [itemBiblia] : []), ...await biblioteca.listar()];
  const biblias = new PastaDeBiblias(pastaBiblias ?? path.join(os.tmpdir(), 'projetor-sem-biblias'));
  if (pastaBiblias) await biblias.iniciar();
  let itens = await listarTudo();
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
  // Como o site que está no ar aparece no telão: 'janela' (tela cheia aberta pelo programa) ou 'captura'
  // (sem Chrome/Edge: abre no navegador padrão e o telão pede para escolher a janela). null = abrindo.
  let modoSite = null;
  const siteNoAr = (est) => {
    const item = est.atual && itens.find((i) => i.id === est.atual.id);
    return item?.tipo === 'site' ? item : null;
  };
  const telaDoTelao = () => [...wss.clients].find((c) => c.papel === 'telao' && c.tela)?.tela;
  const pacote = () => JSON.stringify({ tipo: 'estado', estado, itens, controles: controles(), site: siteNoAr(estado) ? modoSite : null });
  const transmitir = () => {
    const msg = pacote();
    for (const cliente of wss.clients) if (cliente.readyState === 1) cliente.send(msg);
  };
  const mudarEstado = (novo) => {
    if (novo === estado) return;
    const antes = siteNoAr(estado);
    const depois = siteNoAr(novo);
    if (novo.cultos !== estado.cultos) writeFile(arquivoCultos, JSON.stringify(novo.cultos, null, 2)).catch(() => {});
    estado = novo;
    if (depois && depois.id !== antes?.id) abrirSite(depois);          // site foi para o telão
    else if (!depois && antes) fecharSite();                           // saiu do ar
    else if (depois && modoSite?.modo === 'janela') janelaSite.ajustar({ volume: novo.volume, tocando: novo.video.tocando });
    transmitir();
  };

  // Mostra um site em tela cheia, sem ninguém mexer no computador. Sem Chrome/Edge (ou se falhar),
  // abre no navegador padrão e o telão pede para escolher a janela (captura de tela).
  async function abrirSite(item) {
    modoSite = null;
    try {
      if (!janelaSite.disponivel) throw new Error('sem Chrome ou Edge');
      await janelaSite.abrir(item.link, { tela: telaDoTelao(), volume: estado.volume, tocando: estado.video.tocando });
      if (siteNoAr(estado)?.id !== item.id) { await janelaSite.fechar(); return; } // trocaram de item enquanto abria
      modoSite = { modo: 'janela' };
    } catch (erro) {
      registrar(`Não foi possível abrir a janela do site (${erro.message}). Abrindo no navegador padrão.`);
      modoSite = { modo: 'captura' };
      abrirLink(item.link);
    }
    transmitir();
  }
  function fecharSite() {
    const eraJanela = modoSite?.modo === 'janela';
    modoSite = null;
    if (eraJanela) janelaSite.fechar().catch(() => {});
  }
  servidor.on('close', () => { janelaSite.fechar?.().catch(() => {}); });
  // Percebe arquivos de Bíblia colocados na pasta, sem precisar reiniciar.
  const olharBiblias = setInterval(() => biblias.verificar().catch(() => {}), 5000);
  olharBiblias.unref();
  servidor.on('close', () => clearInterval(olharBiblias));
  const recarregar = async () => {
    itens = await listarTudo();
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
        // O telão informa onde está (monitor), para o site abrir em tela cheia no mesmo monitor.
        const t = comando.tela;
        if (socket.papel === 'telao' && t && [t.x, t.y, t.w, t.h].every(Number.isFinite) && t.w > 0 && t.h > 0) socket.tela = { x: t.x, y: t.y, w: t.w, h: t.h };
        transmitir();
        return;
      }
      mudarEstado(aplicarComando(estado, comando, itens));
    });
    socket.on('close', () => { if (socket.papel === 'controle') transmitir(); });
  });

  app.get('/', (_req, res) => res.redirect('/controle.html'));
  app.use(express.static(pastaPublica, {
    setHeaders: (res, arquivo) => {
      if (arquivo.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    },
  }));
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
    const porta = servidor.address().port;
    const url = `http://${enderecoNaRede()}:${porta}/`;
    // Nome do computador na rede (iPhone costuma achar por ele mesmo se o número mudar).
    const nome = os.hostname().split('.')[0];
    const urlNome = /^[A-Za-z0-9-]+$/.test(nome) ? `http://${nome.toLowerCase()}.local:${porta}/` : null;
    return { url, urlNome, qrcode: await QRCode.toDataURL(url, { margin: 1, width: 400 }) };
  }));

  app.post('/api/enviar', upload.array('arquivos', 200), rota(async (req) => {
    const arquivos = (req.files ?? []).map((f) => ({
      // O multer entrega o nome em latin1; converte para manter acentos.
      nomeOriginal: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      caminho: f.path,
    }));
    try {
      const criados = await biblioteca.adicionar(arquivos);
      itens = await listarTudo();
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
    itens = await listarTudo();
    let novo = estado;
    for (const dia of req.body?.dias ?? []) novo = adicionarAoDia(novo, dia, [copia.id]);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
    return { copia };
  }));

  // Abre a janela das pastas dos dias no computador (Explorador de Arquivos / Finder).
  app.post('/api/abrir-pastas', rota(async () => {
    if (!pastaDias) throw new Error('Pastas dos dias desligadas.');
    abrirPasta(pastaDias);
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

  // Link colado no celular: YouTube vira item de YouTube; qualquer outro endereço (Univer etc.) vira item de site.
  app.post('/api/link', rota(async (req) => {
    const bruto = String(req.body?.link ?? '').trim();
    if (!bruto) throw new Error('Cole um link.');
    const youtube = lerLinkYoutube(bruto);
    let item;
    if (youtube) {
      item = await biblioteca.salvarYoutube({ link: bruto, nome: req.body?.nome || await tituloYoutube(bruto), ...youtube });
    } else {
      const link = lerLinkSite(bruto);
      if (!link) throw new Error('Não entendi esse link. Cole o endereço completo da página.');
      item = await biblioteca.salvarSite({ link, nome: req.body?.nome || await tituloSite(link) });
    }
    itens = await listarTudo();
    const novo = adicionarAoDia(estado, req.body?.dia, [item.id]);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
    return { item };
  }));

  // Abre de novo, no computador, a página de um item de site (se a janela foi fechada).
  app.post('/api/itens/:id/abrir-no-computador', rota(async (req) => {
    const item = itens.find((i) => i.id === req.params.id);
    if (item?.tipo !== 'site') throw new Error('Este item não é um site.');
    if (modoSite?.modo === 'janela') await janelaSite.abrir(item.link, { tela: telaDoTelao(), volume: estado.volume, tocando: estado.video.tocando });
    else abrirLink(item.link);
    return { ok: true };
  }));

  // (versão antiga, só YouTube) mantida para quem já usa.
  app.post('/api/youtube', rota(async (req) => {
    const link = String(req.body?.link ?? '').trim();
    const lido = lerLinkYoutube(link);
    if (!lido) throw new Error('Não reconheci esse link. Use o link do vídeo ou da transmissão (ex.: youtube.com/live/...).');
    const nome = req.body?.nome || await tituloYoutube(link);
    const item = await biblioteca.salvarYoutube({ link, nome, ...lido });
    itens = await listarTudo();
    const novo = adicionarAoDia(estado, req.body?.dia, [item.id]);
    if (novo !== estado) mudarEstado(novo);
    else transmitir();
    return { item };
  }));

  // ---------- Bíblia (o programa não traz texto: lê os arquivos da pasta "8 - Bíblias") ----------
  const versao = (id) => {
    const b = biblias.versoes.get(String(id));
    if (!b) throw new Error('Versão da Bíblia não encontrada. Toque em Atualizar ou coloque o arquivo na pasta.');
    return b;
  };
  app.get('/api/biblias', rota(async () => {
    await biblias.verificar();
    return { versoes: biblias.lista(), erros: biblias.erros, pasta: pastaBiblias ?? null };
  }));
  app.post('/api/biblias/atualizar', rota(async () => { await biblias.recarregar(); return { versoes: biblias.lista(), erros: biblias.erros }; }));
  app.post('/api/biblias/abrir-pasta', rota(async () => {
    if (!pastaBiblias) throw new Error('Pasta das Bíblias desligada.');
    abrirPasta(pastaBiblias);
    return { ok: true };
  }));
  // Enviar o arquivo da Bíblia pelo celular: confere se dá para ler antes de guardar.
  app.post('/api/biblias', upload.single('arquivo'), rota(async (req) => {
    if (!pastaBiblias) throw new Error('Pasta das Bíblias desligada.');
    if (!req.file) throw new Error('Escolha o arquivo da Bíblia.');
    const nome = path.basename(Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    try {
      if (!/\.(csv|tsv|txt|json|xml)$/i.test(nome)) throw new Error('Formato não aceito. Use CSV, JSON, XML ou TXT.');
      lerBiblia(await readFile(req.file.path, 'utf8'), nome); // se não conseguir ler, avisa e não guarda
      await mkdir(pastaBiblias, { recursive: true });
      await writeFile(path.join(pastaBiblias, nome), await readFile(req.file.path));
    } finally {
      await rm(req.file.path, { force: true });
    }
    await biblias.recarregar();
    return { versoes: biblias.lista(), erros: biblias.erros };
  }));
  app.get('/api/biblia/:versao/livros', rota(async (req) => versao(req.params.versao).livros.map((l, i) => ({
    i, nome: l.nome, abrev: l.abrev, capitulos: l.capitulos.length, antigo: l.posicao >= 0 && l.posicao < 39,
  }))));
  app.get('/api/biblia/:versao/busca', rota(async (req) => {
    const b = versao(req.params.versao);
    const q = String(req.query.q ?? '');
    const ref = b.resolver(q);
    const resultado = { referencia: null, resultados: [] };
    if (ref) {
      const cap = b.capitulo(ref.indiceLivro, ref.cap);
      const de = ref.de ?? 1; const ate = Math.min(ref.ate ?? ref.de ?? cap.versiculos.length, cap.versiculos.length);
      resultado.referencia = { ...ref, livro: cap.livro.nome, de, ate, versiculos: cap.versiculos.slice(de - 1, ate) };
    }
    resultado.resultados = b.buscar(q);
    return resultado;
  }));
  app.get('/api/biblia/:versao/:livro/:cap', rota(async (req) => {
    const c = versao(req.params.versao).capitulo(Number(req.params.livro), Number(req.params.cap));
    if (!c) throw new Error('Capítulo não encontrado.');
    return { livro: c.livro.nome, indiceLivro: Number(req.params.livro), cap: c.cap, capitulos: versao(req.params.versao).livros[Number(req.params.livro)].capitulos.length, versiculos: c.versiculos };
  }));
  // Mostra um versículo no telão (o capítulo inteiro fica carregado: Avançar e Voltar passam de versículo em versículo).
  app.post('/api/biblia/abrir', rota(async (req) => {
    const b = versao(req.body?.versao);
    const c = b.capitulo(Number(req.body?.livro), Number(req.body?.cap));
    if (!c) throw new Error('Capítulo não encontrado.');
    const verso = Math.min(Math.max(Number(req.body?.verso) || 1, 1), c.versiculos.length);
    itemBiblia = {
      id: 'biblia', tipo: 'biblia', nome: `${c.livro.nome} ${c.cap} · ${b.versao}`, versao: b.versao, livro: c.livro.nome,
      indiceLivro: Number(req.body.livro), cap: c.cap, versiculos: c.versiculos, criadaEm: '',
    };
    itens = await listarTudo();
    mudarEstado(aplicarComando(estado, { acao: 'abrir', id: 'biblia', slide: verso - 1 }, itens));
    transmitir();
    return { ok: true };
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
    if (req.params.id === ITEM_TELA.id) throw new Error('A tela do computador não pode ser apagada.');
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
        itens = await listarTudo();
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
