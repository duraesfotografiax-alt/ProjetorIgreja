# Projetor Igreja

Mostra slides no telão da igreja e é controlado pelo celular.

- **Envie o PDF pelo celular.** Ele vira slides automaticamente, na ordem certa. Não precisa converter para JPEG nem numerar nada.
- **Controle pelo celular:** próximo, anterior, escolher o slide pela miniatura, tela preta.
- **Conexão por QR code:** o telão mostra um QR code. É só apontar a câmera do celular. Não precisa instalar aplicativo.
- Também aceita imagens (JPG, PNG). Várias imagens enviadas juntas viram uma apresentação, na ordem do nome.

## Como usar

### 1. Instalar (só na primeira vez)

Instale o **Node.js**, versão LTS, pelo site <https://nodejs.org>.

### 2. Abrir

- **Windows:** dê dois cliques em `iniciar-windows.bat`
- **Mac:** dê dois cliques em `iniciar-mac.command`

Na primeira vez, ele instala o que precisa e demora um pouco. Depois, o navegador abre a tela do telão.

### 3. Colocar no telão

Arraste a janela do navegador para o telão ou projetor e aperte **F11** para tela cheia.

### 4. Conectar o celular

O celular precisa estar **no mesmo Wi-Fi** que o computador. Aponte a câmera para o QR code do telão e abra o link.

Pelo celular você pode:

- tocar em **Escolher PDF ou imagens** e mandar o arquivo (pode ser o que chegou no WhatsApp);
- tocar na apresentação e escolher o slide;
- usar **Próximo** e **◀** para passar os slides;
- usar **Tela preta** para apagar o telão sem fechar nada.

No computador, as setas do teclado também passam os slides, e a tecla **B** liga ou desliga a tela preta.

## Onde ficam os arquivos

Os slides ficam na pasta `biblioteca/`, um subdiretório para cada apresentação, com as imagens numeradas (`001.jpg`, `002.jpg`, …).

## Segurança

Qualquer aparelho no mesmo Wi-Fi que abrir o endereço consegue controlar o telão. Use numa rede da igreja em que você confia.

## Para desenvolvedores

```bash
npm install
npm start     # sobe em http://localhost:8080 (mude com PORTA=9000)
npm test
```

- `server.js` inicia o servidor.
- `src/`: conversão de PDF (`pdf.js`), biblioteca de apresentações, estado do telão e servidor HTTP/WebSocket.
- `public/`: telas do telão (`telao.html`) e do celular (`controle.html`).

## Próximas etapas

1. Vídeos: enviar pelo celular e controlar play, pause e volume.
2. Lista do culto: a ordem de tudo o que vai passar.
3. Letras de música e Bíblia.
