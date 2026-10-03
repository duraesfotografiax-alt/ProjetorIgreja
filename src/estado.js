// Estado do que está no telão e os comandos que o celular pode enviar.
import { totalPartes } from './biblioteca.js';

export function estadoInicial(culto = []) {
  return {
    atual: null,                               // { id, slide } do que está no telão
    telaPreta: false,
    video: { tocando: false, reinicio: 0 },    // reinicio muda quando o vídeo deve voltar ao começo
    volume: 1,
    culto,                                     // ids dos itens na ordem do culto
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
      return abrir(estado, item, Number(comando.slide) || 0);
    }
    case 'proximo':
    case 'anterior': {
      if (!atual) return estado;
      const passo = comando.acao === 'proximo' ? 1 : -1;
      const slide = estado.atual.slide + passo;
      if (slide >= 0 && slide < totalPartes(atual)) {
        return { ...estado, atual: { id: atual.id, slide } };
      }
      // Passou do fim (ou do começo): segue para o item vizinho na lista do culto.
      const vizinho = buscar(estado.culto[estado.culto.indexOf(atual.id) + passo]);
      if (!estado.culto.includes(atual.id) || !vizinho || totalPartes(vizinho) === 0) return estado;
      return abrir(estado, vizinho, passo > 0 ? 0 : totalPartes(vizinho) - 1);
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
      if (!Array.isArray(comando.itens)) return estado;
      const culto = [...new Set(comando.itens)].filter((id) => buscar(id));
      return { ...estado, culto };
    }
    default:
      return estado;
  }
}

function abrir(estado, item, slide) {
  const novo = {
    ...estado,
    atual: { id: item.id, slide: Math.min(Math.max(slide, 0), totalPartes(item) - 1) },
    telaPreta: false,
  };
  // Vídeo começa a tocar do início assim que vai para o telão.
  if (item.tipo === 'video') novo.video = { tocando: true, reinicio: estado.video.reinicio + 1 };
  else novo.video = { ...estado.video, tocando: false };
  return novo;
}

// Depois de apagar itens: tira do telão e da lista do culto o que não existe mais.
export function ajustarAposRemocao(estado, itens) {
  const existe = (id) => itens.some((i) => i.id === id);
  const culto = estado.culto.filter(existe);
  const atual = estado.atual && !existe(estado.atual.id) ? null : estado.atual;
  if (atual === estado.atual && culto.length === estado.culto.length) return estado;
  return { ...estado, atual, culto };
}
