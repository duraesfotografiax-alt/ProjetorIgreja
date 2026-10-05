# Projetor Igreja

Mostra slides, letras de música e vídeos no telão da igreja, tudo controlado pelo celular.

- **Envie o PDF pelo celular.** Ele vira slides automaticamente, na ordem certa. Não precisa converter para JPEG nem numerar nada.
- **Músicas:** cadastre a letra pelo celular (pode colar). Cada estrofe vira uma tela, com letra grande e legível. Tem busca por nome ou trecho da letra.
- **Vídeos:** envie pelo celular. Tocar, pausar, voltar ao início e volume, tudo pelo celular.
- **Pastas dos dias no computador:** coloque o arquivo na pasta do dia (ex.: `Pastas do Projetor/3 - Quarta`) e ele aparece no programa sozinho em poucos segundos, já convertido e na lista daquele dia. Não precisa atualizar nada.
- **Copiar slides para outros dias:** se o PDF de segunda tem um slide falando de domingo, escolha só esse slide e copie para os dias que quiser.
- **Uma lista para cada dia (segunda a domingo):** o programa abre direto na lista de hoje. O mesmo item pode estar em vários dias (por exemplo, a chamada de segunda no domingo e na segunda), e o botão **Próximo** passa de um item para o outro sozinho.
- **Controle pelo celular:** próximo, anterior, escolher o slide ou a estrofe, tela preta.
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

O controle no celular tem três abas:

- **Culto:** escolha o dia (Seg, Ter, … Dom; o pontinho verde marca hoje) e veja a ordem daquele dia. Reordene com ↑ ↓, tire com ✕ ou use **Limpar dia** (os arquivos continuam guardados).
- **Arquivos:** escolha em **Colocar em** o dia e envie PDF, imagens ou vídeo (pode ser o que chegou no WhatsApp). Eles já entram na lista daquele dia. Toque num item para escolher o slide e, em **Mostrar nos dias**, ligue ou desligue os dias em que ele aparece. Os botões **Todos · Seg · Ter… · Sem dia** filtram a lista.
- **Copiar slides:** abra um PDF, toque em **⧉ Copiar slides para outros dias**, toque nos slides que quer, marque os dias e confirme. Os slides viram um item novo, que fica salvo.
- **Músicas:** toque em **+ Nova**, escreva o nome e cole a letra. Deixe **uma linha em branco entre as estrofes**: cada estrofe vira uma tela. Para colocar a música num dia, abra a música e marque o dia em **Mostrar nos dias**.

Na parte de cima ficam sempre **Próximo** e **◀**, **Tela preta** e **Tirar do telão**. Quando um vídeo está no telão, aparecem os botões do vídeo e o volume.

**Som do vídeo:** os navegadores só liberam som depois de alguém clicar na página do telão. Clique uma vez no telão ao abrir (por exemplo, em "tela cheia"). Se esquecer, o vídeo toca sem som e aparece um aviso no canto. É só clicar nele.

No computador, as setas do teclado também passam os slides, e a tecla **B** liga ou desliga a tela preta.

## Pastas dos dias (no computador)

Ao abrir o programa, ele cria a pasta `Pastas do Projetor`, ao lado do `iniciar-windows.bat`:

```
Pastas do Projetor/
  0 - Geral (sem dia)
  1 - Segunda
  2 - Terça
  3 - Quarta
  4 - Quinta
  5 - Sexta
  6 - Sábado
  7 - Domingo
```

Coloque o arquivo (PDF, JPG, PNG, MP4…) na pasta do dia, copiando do pen drive ou do WhatsApp Web. Em poucos segundos ele aparece no celular, já convertido e na lista daquele dia. O arquivo original continua na pasta e não é importado de novo. Pelo celular, o botão **📁 Abrir as pastas dos dias no computador** abre essa janela no computador.

## Onde ficam os arquivos

**Nada some ao fechar o programa ou desligar o computador.** Tudo fica na pasta `biblioteca/`, um subdiretório por item. Os slides ficam numerados (`001.jpg`, `002.jpg`, …), e as músicas e os vídeos ficam em suas próprias pastas. As listas de cada dia ficam salvas em `biblioteca/cultos.json` e continuam lá quando você fecha e abre o programa.

## Segurança

Qualquer aparelho no mesmo Wi-Fi que abrir o endereço consegue controlar o telão. Use numa rede da igreja em que você confia.

## Para desenvolvedores

```bash
npm install
npm start     # sobe em http://localhost:8080 (mude com PORTA=9000)
npm test
```

- `server.js` inicia o servidor.
- `src/`: conversão de PDF (`pdf.js`), biblioteca de itens (`biblioteca.js`: slides, músicas, vídeos), estado do telão e comandos (`estado.js`), servidor HTTP/WebSocket (`servidor.js`).
- `public/`: telas do telão (`telao.html`) e do celular (`controle.html`).

## Próximas etapas

1. Bíblia: buscar versículo e mostrar no telão.
2. Personalizar o fundo das músicas (cor e imagem) e o tamanho da letra.
3. Avisos rolando na parte de baixo da tela e cronômetro.
