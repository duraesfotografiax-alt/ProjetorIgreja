// Conexão em tempo real com o computador. Reconecta sozinha se o Wi-Fi cair.
export function conectar({ aoReceberEstado, aoMudarConexao }) {
  let socket;
  let fila = [];

  function abrir() {
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocolo}://${location.host}/ws`);
    socket.onopen = () => {
      aoMudarConexao?.(true);
      fila.forEach((m) => socket.send(m));
      fila = [];
    };
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.tipo === 'estado') aoReceberEstado(msg.estado, msg.apresentacoes);
    };
    socket.onclose = () => {
      aoMudarConexao?.(false);
      setTimeout(abrir, 1500);
    };
  }
  abrir();

  return function enviar(comando) {
    const msg = JSON.stringify(comando);
    if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    else fila = [msg];
  };
}

export function urlSlide(apresentacao, indice) {
  return `/midia/${apresentacao.id}/${apresentacao.slides[indice]}`;
}
