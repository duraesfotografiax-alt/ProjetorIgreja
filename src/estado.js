// Estado do que está no telão e os comandos que o celular pode enviar.
export function estadoInicial() {
  return { atual: null, telaPreta: false };
}

// Aplica um comando e devolve o novo estado. Comandos inválidos não mudam nada.
export function aplicarComando(estado, comando, apresentacoes) {
  const buscar = (id) => apresentacoes.find((a) => a.id === id);
  const atual = estado.atual && buscar(estado.atual.id);

  switch (comando?.acao) {
    case 'abrir': {
      const ap = buscar(comando.id);
      if (!ap || ap.slides.length === 0) return estado;
      const slide = limitar(Number(comando.slide) || 0, ap.slides.length);
      return { ...estado, atual: { id: ap.id, slide }, telaPreta: false };
    }
    case 'proximo':
    case 'anterior': {
      if (!atual) return estado;
      const passo = comando.acao === 'proximo' ? 1 : -1;
      return { ...estado, atual: { id: atual.id, slide: limitar(estado.atual.slide + passo, atual.slides.length) } };
    }
    case 'telaPreta':
      return { ...estado, telaPreta: Boolean(comando.ligada) };
    case 'fechar':
      return { ...estado, atual: null };
    default:
      return estado;
  }
}

// Se a apresentação no telão foi apagada, volta para a tela inicial.
export function ajustarAposRemocao(estado, apresentacoes) {
  if (estado.atual && !apresentacoes.some((a) => a.id === estado.atual.id)) {
    return { ...estado, atual: null };
  }
  return estado;
}

function limitar(indice, total) {
  return Math.min(Math.max(indice, 0), total - 1);
}
