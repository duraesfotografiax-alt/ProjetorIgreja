// Estado do que está no telão e os comandos que o celular pode enviar.
import { totalPartes } from './biblioteca.js';

// Uma lista de culto para cada dia da semana, de segunda a domingo.
export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const DIA_DO_JS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']; // Date.getDay(): 0 = domingo

export function diaDaSemana(data = new Date()) {
  return DIA_DO_JS[data.getDay()];
}

// Garante que existe uma lista (array de ids) para cada dia.
export function normalizarCultos(cultos) {
  return Object.fromEntries(DIAS.map((dia) => [dia, Array.isArray(cultos?.[dia]) ? cultos[dia] : []]));
}

export function estadoInicial(cultos = {}, hoje = diaDaSemana()) {
  return {
    atual: null,                               // { id, slide, dia } do que está no telão
    telaPreta: false,
    video: { tocando: false, reinicio: 0 },    // reinicio muda quando o vídeo deve voltar ao começo
    volume: 1,
    cultos: normalizarCultos(cultos),          // { seg: [ids], ter: [...], ... }
    hoje,
  };
}

// Aplica um comando e devolve o novo estado. Comandos inválidos não mudam nada.
export function aplicarComando(estado, comando, itens) {
  const buscar = (id) => itens.find((i) => i.id === id);
  const atual = estado.atual && buscar(estado.atual.id);

  switch (comando?.acao) {
    case 'abrir': {
      const item = buscar(comando.id);
      if (!item || totalPartes(item) === 0) return estado;
      // A lista do dia decide o que vem antes e depois. Sem dia informado, usa a de hoje.
      const dia = DIAS.includes(comando.dia) ? comando.dia
        : estado.cultos[estado.hoje].includes(item.id) ? estado.hoje : null;
      return abrir(estado, item, Number(comando.slide) || 0, dia);
    }
    case 'proximo':
    case 'anterior': {
      if (!atual) return estado;
      const passo = comando.acao === 'proximo' ? 1 : -1;
      const slide = estado.atual.slide + passo;
      if (slide >= 0 && slide < totalPartes(atual)) {
        return { ...estado, atual: { ...estado.atual, slide } };
      }
      // Passou do fim (ou do começo): segue para o item vizinho na lista do dia.
      const lista = estado.atual.dia ? estado.cultos[estado.atual.dia] : [];
      const posicao = lista.indexOf(atual.id);
      const vizinho = buscar(lista[posicao + passo]);
      if (posicao < 0 || !vizinho || totalPartes(vizinho) === 0) return estado;
      return abrir(estado, vizinho, passo > 0 ? 0 : totalPartes(vizinho) - 1, estado.atual.dia);
    }
    case 'telaPreta':
      return { ...estado, telaPreta: Boolean(comando.ligada) };
    case 'fechar':
      return { ...estado, atual: null, video: { ...estado.video, tocando: false } };
    case 'video': {
      if (atual?.tipo !== 'video') return estado;
      if (comando.comando === 'tocar') return { ...estado, video: { ...estado.video, tocando: true } };
      if (comando.comando === 'pausar') return { ...estado, video: { ...estado.video, tocando: false } };
      if (comando.comando === 'reiniciar') return { ...estado, video: { tocando: true, reinicio: estado.video.reinicio + 1 } };
      return estado;
    }
    case 'volume': {
      const valor = Number(comando.valor);
      if (!Number.isFinite(valor)) return estado;
      return { ...estado, volume: Math.min(Math.max(valor, 0), 1) };
    }
    case 'culto': {
      if (!DIAS.includes(comando.dia) || !Array.isArray(comando.itens)) return estado;
      const lista = [...new Set(comando.itens)].filter((id) => buscar(id));
      return { ...estado, cultos: { ...estado.cultos, [comando.dia]: lista } };
    }
    default:
      return estado;
  }
}

// Coloca itens no fim da lista de um dia (usado depois de enviar arquivos).
export function adicionarAoDia(estado, dia, ids) {
  if (!DIAS.includes(dia) || ids.length === 0) return estado;
  const lista = [...new Set([...estado.cultos[dia], ...ids])];
  return { ...estado, cultos: { ...estado.cultos, [dia]: lista } };
}

function abrir(estado, item, slide, dia) {
  const novo = {
    ...estado,
    atual: { id: item.id, slide: Math.min(Math.max(slide, 0), totalPartes(item) - 1), dia },
    telaPreta: false,
  };
  // Vídeo começa a tocar do início assim que vai para o telão.
  if (item.tipo === 'video') novo.video = { tocando: true, reinicio: estado.video.reinicio + 1 };
  else novo.video = { ...estado.video, tocando: false };
  return novo;
}

// Depois de apagar itens: tira do telão e das listas dos dias o que não existe mais.
export function ajustarAposRemocao(estado, itens) {
  const existe = (id) => itens.some((i) => i.id === id);
  let mudou = false;
  const cultos = Object.fromEntries(DIAS.map((dia) => {
    const lista = estado.cultos[dia].filter(existe);
    if (lista.length !== estado.cultos[dia].length) mudou = true;
    return [dia, lista];
  }));
  const atual = estado.atual && !existe(estado.atual.id) ? null : estado.atual;
  if (atual === estado.atual && !mudou) return estado;
  return { ...estado, atual, cultos: mudou ? cultos : estado.cultos };
}
