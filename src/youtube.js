// Entende links do YouTube: vídeo comum, transmissão ao vivo, Shorts e canal ao vivo.
const ID = /^[A-Za-z0-9_-]{11}$/;
const CANAL = /^UC[A-Za-z0-9_-]{22}$/;

// Devolve { videoId } ou { canal } (canal = transmissão ao vivo atual do canal), ou null.
export function lerLinkYoutube(texto) {
  let url;
  try {
    url = new URL(String(texto ?? '').trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const partes = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return ID.test(partes[0]) ? { videoId: partes[0] } : null;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;

  const v = url.searchParams.get('v');
  if (partes[0] === 'watch' && ID.test(v ?? '')) return { videoId: v };
  if (['live', 'shorts', 'embed'].includes(partes[0]) && ID.test(partes[1] ?? '')) return { videoId: partes[1] };
  if (partes[0] === 'channel' && CANAL.test(partes[1] ?? '')) return { canal: partes[1] };
  return null;
}

// Nome do vídeo pelo serviço público do YouTube (oEmbed). Sem internet, devolve null.
export async function tituloYoutube(link, { tempo = 4000 } = {}) {
  try {
    const resposta = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`,
      { signal: AbortSignal.timeout(tempo) });
    if (!resposta.ok) return null;
    return (await resposta.json()).title ?? null;
  } catch {
    return null;
  }
}
