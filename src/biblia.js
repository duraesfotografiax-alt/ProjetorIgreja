// Bíblia: lê o arquivo de uma versão (CSV, JSON, XML Zefania ou texto), entende os nomes dos livros
// e procura por referência (João 3:16) ou por palavras. O programa NÃO traz texto bíblico:
// a igreja coloca o arquivo da versão que tem permissão de usar.
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Os 66 livros, na ordem: [nome, abreviação, ...outros jeitos de escrever]
const LISTA = [
  ['Gênesis', 'Gn', 'gen'], ['Êxodo', 'Êx', 'ex', 'exo'], ['Levítico', 'Lv', 'lev'], ['Números', 'Nm', 'num'], ['Deuteronômio', 'Dt', 'deut'],
  ['Josué', 'Js', 'jos'], ['Juízes', 'Jz', 'juiz'], ['Rute', 'Rt'], ['1 Samuel', '1Sm'], ['2 Samuel', '2Sm'], ['1 Reis', '1Rs'], ['2 Reis', '2Rs'],
  ['1 Crônicas', '1Cr'], ['2 Crônicas', '2Cr'], ['Esdras', 'Ed', 'esd'], ['Neemias', 'Ne'], ['Ester', 'Et', 'est'], ['Jó', 'Jó', 'job'],
  ['Salmos', 'Sl', 'salmo', 'sal'], ['Provérbios', 'Pv', 'prov'], ['Eclesiastes', 'Ec', 'ecl'],
  ['Cantares de Salomão', 'Ct', 'cantares', 'cantico dos canticos', 'canticos', 'cantares de salomao'],
  ['Isaías', 'Is'], ['Jeremias', 'Jr', 'jer'], ['Lamentações', 'Lm', 'lam', 'lamentacoes de jeremias'], ['Ezequiel', 'Ez', 'eze'], ['Daniel', 'Dn', 'dan'],
  ['Oseias', 'Os', 'oseas'], ['Joel', 'Jl'], ['Amós', 'Am'], ['Obadias', 'Ob', 'abdias'], ['Jonas', 'Jn'], ['Miqueias', 'Mq', 'miqueas'],
  ['Naum', 'Na', 'nah'], ['Habacuque', 'Hc', 'hab'], ['Sofonias', 'Sf', 'sof'], ['Ageu', 'Ag'], ['Zacarias', 'Zc', 'zac'], ['Malaquias', 'Ml', 'mal'],
  ['Mateus', 'Mt', 'mat'], ['Marcos', 'Mc', 'mar'], ['Lucas', 'Lc', 'luc'], ['João', 'Jo', 'joa'], ['Atos', 'At', 'atos dos apostolos'],
  ['Romanos', 'Rm', 'rom'], ['1 Coríntios', '1Co'], ['2 Coríntios', '2Co'], ['Gálatas', 'Gl', 'gal'], ['Efésios', 'Ef', 'efe'],
  ['Filipenses', 'Fp', 'fil'], ['Colossenses', 'Cl', 'col'], ['1 Tessalonicenses', '1Ts'], ['2 Tessalonicenses', '2Ts'],
  ['1 Timóteo', '1Tm'], ['2 Timóteo', '2Tm'], ['Tito', 'Tt'], ['Filemom', 'Fm', 'filemon'], ['Hebreus', 'Hb', 'heb'], ['Tiago', 'Tg', 'tia'],
  ['1 Pedro', '1Pe'], ['2 Pedro', '2Pe'], ['1 João', '1Jo'], ['2 João', '2Jo'], ['3 João', '3Jo'], ['Judas', 'Jd'], ['Apocalipse', 'Ap', 'apo', 'apocalipse de joao'],
];
export const LIVROS = LISTA.map(([nome, abrev]) => ({ nome, abrev }));
export const TOTAL_ANTIGO_TESTAMENTO = 39;

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
// "1º Coríntios", "I Co", "Primeiro Coríntios" → "1corintios"
function chave(texto) {
  let t = String(texto ?? '').trim().toLowerCase();
  t = t.replace(/^(primeiro|primeira)\s+/, '1 ').replace(/^(segundo|segunda)\s+/, '2 ').replace(/^(terceiro|terceira)\s+/, '3 ')
    .replace(/^iii\s+/, '3 ').replace(/^ii\s+/, '2 ').replace(/^i\s+/, '1 ').replace(/^([123])\s*[ºo°]\s*/, '$1 ');
  return semAcento(t).replace(/[.\s]+/g, '');
}

// nome escrito → posição (0 a 65). "Jó" com acento é Jó; "Jo" sem acento é João.
const porNome = new Map();
const porNomeComAcento = new Map();
LISTA.forEach(([nome, ...outros], i) => {
  for (const n of [nome, ...outros]) {
    porNomeComAcento.set(String(n).trim().toLowerCase().replace(/[.\s]+/g, ''), i);
    if (!porNome.has(chave(n))) porNome.set(chave(n), i);
  }
});
porNome.set('jo', 42); // "Jo" = João; Jó só com acento (ou "Job")
porNome.set('atos', 43);

export function identificarLivro(texto) {
  const bruto = String(texto ?? '').trim();
  if (/^\d{1,2}$/.test(bruto)) { const n = Number(bruto); return n >= 1 && n <= 66 ? n - 1 : -1; }
  const exato = porNomeComAcento.get(bruto.toLowerCase().replace(/[.\s]+/g, ''));
  if (exato !== undefined && /[óô]/i.test(bruto)) return exato; // "Jó" com acento
  return porNome.get(chave(bruto)) ?? -1;
}

// ---------- Montagem: livro > capítulo > versículo ----------
class Montador {
  constructor() { this.livros = new Map(); this.extras = []; }
  adicionar(livro, cap, verso, texto) {
    const c = Number(cap); const v = Number(verso);
    const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
    if (!Number.isInteger(c) || !Number.isInteger(v) || c < 1 || v < 1 || !t) return;
    let i = identificarLivro(livro);
    let chaveLivro;
    if (i >= 0) chaveLivro = i;
    else { chaveLivro = `x:${String(livro).trim()}`; if (!this.extras.includes(chaveLivro)) this.extras.push(chaveLivro); }
    if (!this.livros.has(chaveLivro)) this.livros.set(chaveLivro, new Map());
    const caps = this.livros.get(chaveLivro);
    if (!caps.has(c)) caps.set(c, new Map());
    caps.get(c).set(v, t);
  }
  resultado(versao) {
    const livros = [];
    const chaves = [...Array(66).keys()].filter((i) => this.livros.has(i)).concat(this.extras);
    for (const k of chaves) {
      const caps = this.livros.get(k);
      const nCaps = Math.max(...caps.keys());
      const capitulos = [];
      for (let c = 1; c <= nCaps; c++) {
        const vs = caps.get(c);
        const n = vs ? Math.max(...vs.keys()) : 0;
        capitulos.push(Array.from({ length: n }, (_, j) => vs.get(j + 1) ?? '')); // versículo que falta fica vazio
      }
      const nome = typeof k === 'number' ? LIVROS[k].nome : k.slice(2);
      livros.push({ nome, abrev: typeof k === 'number' ? LIVROS[k].abrev : nome.slice(0, 3), posicao: typeof k === 'number' ? k : -1, capitulos });
    }
    if (livros.length === 0) throw new Error('Não encontrei versículos neste arquivo.');
    const versiculos = livros.reduce((s, l) => s + l.capitulos.reduce((a, c) => a + c.filter(Boolean).length, 0), 0);
    return { versao, livros, versiculos };
  }
}

// ---------- Formatos ----------
function lerCSV(texto, m) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length === 0) return;
  const cabeca = linhas[0];
  const delim = [';', '\t', '|', ','].map((d) => [d, cabeca.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const limpa = (s) => s.trim().replace(/^"(.*)"$/s, '$1').replace(/""/g, '"');
  for (const linha of linhas) {
    const p = linha.split(delim);
    if (p.length < 4) continue;
    const cap = limpa(p[1]); const verso = limpa(p[2]);
    if (!/^\d+$/.test(cap) || !/^\d+$/.test(verso)) continue; // cabeçalho ou linha estranha
    m.adicionar(limpa(p[0]), cap, verso, limpa(p.slice(3).join(delim)));
  }
}

function lerJSON(texto, m) {
  const dados = JSON.parse(texto.replace(/^﻿/, ''));
  const versos = (capitulo, cap, livro) => {
    if (Array.isArray(capitulo)) capitulo.forEach((t, j) => m.adicionar(livro, cap, j + 1, typeof t === 'object' ? t?.text ?? t?.texto : t));
    else if (capitulo && typeof capitulo === 'object') for (const [v, t] of Object.entries(capitulo)) m.adicionar(livro, cap, v, typeof t === 'object' ? t?.text ?? t?.texto : t);
  };
  const livroDe = (obj, i, total) => obj.name ?? obj.nome ?? obj.book ?? obj.livro ?? obj.abbrev ?? (total === 66 ? String(i + 1) : `Livro ${i + 1}`);
  const lista = Array.isArray(dados) ? dados : Array.isArray(dados?.books) ? dados.books : Array.isArray(dados?.livros) ? dados.livros : null;
  if (lista) { // [{ name, abbrev, chapters: [[v1, v2…], …] }, …]
    lista.forEach((l, i) => {
      const caps = l.chapters ?? l.capitulos ?? l.caps;
      const nome = livroDe(l, i, lista.length);
      // se só a abreviação veio e ela não é reconhecida, usa a posição (lista completa)
      const livro = identificarLivro(nome) >= 0 || lista.length !== 66 ? nome : String(i + 1);
      if (Array.isArray(caps)) caps.forEach((c, k) => versos(c?.verses ?? c?.versiculos ?? c, k + 1, livro));
      else if (caps && typeof caps === 'object') for (const [k, c] of Object.entries(caps)) versos(c, k, livro);
    });
    return;
  }
  if (dados && typeof dados === 'object') { // { "João": { "3": { "16": "texto" } } } ou { "João": [[…], …] }
    for (const [livro, caps] of Object.entries(dados)) {
      if (Array.isArray(caps)) caps.forEach((c, k) => versos(c, k + 1, livro));
      else if (caps && typeof caps === 'object') for (const [k, c] of Object.entries(caps)) versos(c, k, livro);
    }
  }
}

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (t) => t.replace(/&(#x?[0-9a-f]+|\w+);/gi, (tudo, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : tudo; }
  return entidades[e.toLowerCase()] ?? tudo;
});

function lerXML(texto, m) { // Zefania: <BIBLEBOOK bname> <CHAPTER cnumber> <VERS vnumber>texto</VERS>
  const atributo = (attrs, nome) => attrs.match(new RegExp(`\\b${nome}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  const marcas = /<(BIBLEBOOK|CHAPTER|VERS)\b([^>]*?)(\/?)>|<\/VERS>/gi;
  let livro = null; let cap = null; let verso = null; let inicio = 0; let ma;
  while ((ma = marcas.exec(texto))) {
    if (ma[0].toUpperCase() === '</VERS>') {
      if (verso !== null) m.adicionar(livro, cap, verso, decodificar(texto.slice(inicio, ma.index).replace(/<[^>]*>/g, ' ')));
      verso = null;
    } else if (ma[1].toUpperCase() === 'BIBLEBOOK') livro = atributo(ma[2], 'bname') ?? atributo(ma[2], 'bsname') ?? atributo(ma[2], 'bnumber');
    else if (ma[1].toUpperCase() === 'CHAPTER') cap = atributo(ma[2], 'cnumber');
    else { verso = atributo(ma[2], 'vnumber'); inicio = marcas.lastIndex; }
  }
}

function lerTXT(texto, m) { // "João 3:16 Porque Deus amou…" (um versículo por linha)
  const re = /^\s*((?:[123]|I{1,3})?\s*[\p{L}.]+(?:\s+(?:de|dos|das|do)?\s*[\p{L}.]+)*?)\s+(\d+)\s*[:.,]\s*(\d+)\s*[-–:]?\s*(.+)$/u;
  for (const linha of texto.replace(/^﻿/, '').split(/\r?\n/)) {
    const r = re.exec(linha);
    if (r) m.adicionar(r[1], r[2], r[3], r[4]);
  }
}

// Detecta o formato pela extensão e pelo começo do conteúdo.
export function lerBiblia(conteudo, nomeArquivo) {
  const versao = path.basename(nomeArquivo, path.extname(nomeArquivo)).trim();
  const ext = path.extname(nomeArquivo).toLowerCase();
  const texto = String(conteudo);
  const inicio = texto.replace(/^﻿/, '').trimStart()[0];
  const m = new Montador();
  if (ext === '.json' || inicio === '{' || inicio === '[') lerJSON(texto, m);
  else if (ext === '.xml' || inicio === '<') lerXML(texto, m);
  else {
    lerCSV(texto, m);
    if (m.livros.size === 0) lerTXT(texto, m);
  }
  return m.resultado(versao);
}

// ---------- Referências e busca ----------
// "jo 3:16", "1 co 13", "sl 23:1-3", "Salmos 23" → { livro, cap, de, ate } (de/ate podem faltar)
export function lerReferencia(texto) {
  const r = /^\s*(.+?)\s+(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/.exec(String(texto ?? ''));
  if (!r) return null;
  const livro = identificarLivro(r[1]);
  if (livro < 0) return null;
  return { livro, cap: Number(r[2]), de: r[3] ? Number(r[3]) : null, ate: r[4] ? Number(r[4]) : null };
}

export class Biblia {
  constructor({ versao, livros, versiculos }) { this.versao = versao; this.livros = livros; this.versiculos = versiculos; this.indice = null; }

  // posição canônica (0 a 65) → livro desta versão (se o arquivo tiver)
  livroPorPosicao(posicao) { return this.livros.find((l) => l.posicao === posicao); }

  capitulo(indiceLivro, cap) {
    const livro = this.livros[indiceLivro];
    const versiculos = livro?.capitulos[cap - 1];
    return versiculos ? { livro, cap, versiculos } : null;
  }

  // Referência escrita ("jo 3:16") → { indiceLivro, cap, de, ate } nesta versão
  resolver(texto) {
    const ref = lerReferencia(texto);
    const indiceLivro = ref ? this.livros.findIndex((l) => l.posicao === ref.livro) : -1;
    if (indiceLivro < 0 || !this.livros[indiceLivro].capitulos[ref.cap - 1]) return null;
    return { indiceLivro, cap: ref.cap, de: ref.de, ate: ref.ate };
  }

  // Busca por palavras (todas precisam aparecer), sem diferenciar acento nem maiúscula.
  buscar(texto, limite = 40) {
    const palavras = semAcento(String(texto ?? '').toLowerCase()).split(/\s+/).filter((p) => p.length > 1);
    if (palavras.length === 0) return [];
    this.indice ??= this.livros.flatMap((livro, li) => livro.capitulos.flatMap((vs, ci) => vs.map((t, vi) => (t ? { li, cap: ci + 1, verso: vi + 1, texto: t, plano: semAcento(t.toLowerCase()) } : null)).filter(Boolean)));
    const achados = [];
    for (const v of this.indice) {
      if (palavras.every((p) => v.plano.includes(p))) { achados.push({ livro: this.livros[v.li].nome, indiceLivro: v.li, cap: v.cap, verso: v.verso, texto: v.texto }); if (achados.length >= limite) break; }
    }
    return achados;
  }
}

// ---------- Pasta das Bíblias ----------
const EXTENSOES = new Set(['.csv', '.tsv', '.txt', '.json', '.xml']);

export class PastaDeBiblias {
  constructor(pasta) { this.pasta = pasta; this.versoes = new Map(); this.erros = []; this.assinatura = null; }

  async iniciar() { await mkdir(this.pasta, { recursive: true }); await this.recarregar(); }

  // Só relê se algum arquivo mudou (nome, tamanho ou data).
  async verificar() {
    const arquivos = await this.#arquivos();
    const assinatura = arquivos.map((a) => `${a.nome}:${a.tamanho}:${Math.round(a.mtime)}`).join('|');
    if (assinatura !== this.assinatura) await this.recarregar(arquivos);
  }

  async #arquivos() {
    const lista = [];
    for (const nome of await readdir(this.pasta).catch(() => [])) {
      if (nome.startsWith('.') || !EXTENSOES.has(path.extname(nome).toLowerCase())) continue;
      const info = await stat(path.join(this.pasta, nome)).catch(() => null);
      if (info?.isFile()) lista.push({ nome, tamanho: info.size, mtime: info.mtimeMs });
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async recarregar(arquivos) {
    arquivos ??= await this.#arquivos();
    const versoes = new Map(); const erros = [];
    for (const { nome } of arquivos) {
      try {
        const dados = lerBiblia(await readFile(path.join(this.pasta, nome), 'utf8'), nome);
        versoes.set(dados.versao, Object.assign(new Biblia(dados), { arquivo: nome }));
      } catch (erro) {
        erros.push({ arquivo: nome, erro: erro.message });
      }
    }
    this.versoes = versoes; this.erros = erros;
    this.assinatura = arquivos.map((a) => `${a.nome}:${a.tamanho}:${Math.round(a.mtime)}`).join('|');
  }

  lista() {
    return [...this.versoes.values()].map((b) => ({ id: b.versao, arquivo: b.arquivo, livros: b.livros.length, versiculos: b.versiculos }));
  }
}
