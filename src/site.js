// Links de sites (Univer Vídeo, Facebook, Zoom…): guardados como item, abertos no computador
// e mostrados no telão pela captura de tela (com o volume controlado pelo celular).

// Aceita só endereços http(s). Devolve o endereço normalizado, ou null.
export function lerLinkSite(texto) {
  let url;
  try {
    const bruto = String(texto ?? '').trim();
    // Quem cola "univervideo.com/..." sem o https:// também funciona.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
  return url.href;
}

// Nome da página (og:title ou <title>). Sem internet, ou se o site recusar, devolve null.
export async function tituloSite(link, { tempo = 4000 } = {}) {
  try {
    const resposta = await fetch(link, { signal: AbortSignal.timeout(tempo), headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!resposta.ok) return null;
    const html = (await resposta.text()).slice(0, 300_000);
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const titulo = og?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    return titulo ? titulo.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim() : null;
  } catch {
    return null;
  }
}

export function nomeDoSite(link) {
  return new URL(link).hostname.replace(/^www\./, '');
}
