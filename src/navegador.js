// Janela de navegador controlada pelo programa, para mostrar sites (Univer Vídeo etc.) em tela cheia
// no telão, sem ninguém precisar ir até o computador. O login do site fica salvo no perfil do programa.
import { procurarNavegador } from './abrir.js';

const INTERVALO_MIDIA = 1500;

export class JanelaSite {
  // perfil: pasta onde o navegador guarda o login. caminho: Chrome/Edge. semJanela: só para testes.
  constructor({ perfil, caminho = procurarNavegador(), semJanela = false, registrar = () => {} } = {}) {
    this.perfil = perfil;
    this.caminho = caminho;
    this.semJanela = semJanela;
    this.registrar = registrar;
    this.alvo = { volume: 1, tocando: true }; // tocando = com som (false = silenciado)
    this.navegador = null;
    this.pagina = null;
    this.url = null;
    this.timer = null;
    this.fila = Promise.resolve();
  }

  get disponivel() {
    return Boolean(this.caminho);
  }

  // Uma operação por vez (tocar em dois itens seguidos não abre duas janelas).
  #serial(fn) {
    const proxima = this.fila.then(fn, fn);
    this.fila = proxima.catch(() => {});
    return proxima;
  }

  // Abre (ou reaproveita) a janela e vai para o endereço. tela: onde fica o telão { x, y, w, h }.
  abrir(url, { tela, volume = 1, tocando = true } = {}) {
    return this.#serial(async () => {
      this.alvo = { volume, tocando };
      if (!this.pagina) await this.#iniciar(tela);
      if (this.url !== url) {
        this.url = url;
        // Sem internet ou site fora do ar: a janela mostra o erro do navegador; não derruba o programa.
        await this.pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch((e) => this.registrar(`Site: ${e.message}`));
      }
      await this.#aplicar();
    });
  }

  async #iniciar(tela) {
    const { default: puppeteer } = await import('puppeteer-core');
    const args = ['--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check', '--disable-infobars',
      '--hide-crash-restore-bubble', '--disable-blink-features=AutomationControlled',
      tela ? `--window-position=${Math.round(tela.x)},${Math.round(tela.y)}` : null,
      process.getuid?.() === 0 ? '--no-sandbox' : null].filter(Boolean);
    this.navegador = await puppeteer.launch({
      executablePath: this.caminho, headless: this.semJanela, defaultViewport: null, userDataDir: this.perfil,
      ignoreDefaultArgs: ['--enable-automation'], args,
    });
    this.navegador.on('disconnected', () => this.#zerar());
    this.pagina = (await this.navegador.pages())[0] ?? await this.navegador.newPage();

    // Tela cheia no monitor do telão (se o telão estiver aberto, usa o monitor dele).
    try {
      const sessao = await this.pagina.createCDPSession();
      const { windowId } = await sessao.send('Browser.getWindowForTarget');
      if (tela) await sessao.send('Browser.setWindowBounds', { windowId, bounds: { left: Math.round(tela.x), top: Math.round(tela.y), width: Math.round(tela.w), height: Math.round(tela.h), windowState: 'normal' } });
      await sessao.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
    } catch (erro) {
      this.registrar(`Tela cheia: ${erro.message}`);
    }
    // Players criam o vídeo depois de a página carregar: reaplica volume e som de tempos em tempos.
    this.timer = setInterval(() => this.#aplicar().catch(() => {}), INTERVALO_MIDIA);
    this.timer.unref();
  }

  #zerar() {
    clearInterval(this.timer);
    this.navegador = this.pagina = this.url = this.timer = null;
  }

  // Volume e som do site, pelo celular. Vale para vídeos e áudios, inclusive dentro de outros quadros.
  ajustar({ volume, tocando }) {
    this.alvo = { volume, tocando };
    return this.#aplicar().catch(() => {});
  }

  async #aplicar() {
    if (!this.pagina || this.pagina.isClosed()) return;
    const { volume, tocando } = this.alvo;
    for (const quadro of this.pagina.frames()) {
      await quadro.evaluate((vol, comSom) => {
        for (const m of document.querySelectorAll('video, audio')) {
          m.volume = vol;
          m.muted = !comSom;
          if (!m.__projetorTocou && m.paused && !m.ended) { m.__projetorTocou = true; m.play().catch(() => {}); }
        }
      }, volume, tocando).catch(() => {}); // quadro que sumiu no meio
    }
  }

  // Estado dos vídeos e áudios da página (para conferir e para os testes).
  async consultar() {
    const lista = [];
    if (!this.pagina || this.pagina.isClosed()) return lista;
    for (const quadro of this.pagina.frames()) {
      const medias = await quadro.evaluate(() => [...document.querySelectorAll('video, audio')]
        .map((m) => ({ volume: Math.round(m.volume * 100) / 100, mudo: m.muted, pausado: m.paused }))).catch(() => []);
      lista.push(...medias);
    }
    return lista;
  }

  // Fecha a janela (o login continua salvo no perfil).
  fechar() {
    return this.#serial(async () => {
      const navegador = this.navegador;
      this.#zerar();
      await navegador?.close().catch(() => {});
    });
  }
}
