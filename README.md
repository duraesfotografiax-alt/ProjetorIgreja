# Projetor Durães

Mostra slides, letras de música, vídeos, áudios, YouTube e sites no telão da igreja. Tudo é controlado pelo celular.

## Instalar (uma vez só, uns 15 minutos)

1. **Baixe e extraia** o programa (botão verde **Code → Download ZIP** no GitHub) numa pasta fixa, como a Área de Trabalho. Clique com o botão direito no arquivo → **Extrair tudo**.
2. Dentro da pasta, dê **dois cliques em `iniciar-windows.bat`**.
   - Se o **Node.js** não estiver instalado, ele tenta instalar sozinho (precisa de internet). Quando pedir, **feche a janela e abra de novo**. Se não conseguir, instale a versão **LTS** em <https://nodejs.org>.
   - Na primeira vez ele prepara o programa (alguns minutos) e **cria o ícone “Projetor Durães” na Área de Trabalho**.
   - Se o Windows mostrar **“O Windows protegeu o computador”**: **Mais informações → Executar assim mesmo**.
   - Se aparecer o aviso do **Firewall**: marque **redes privadas e públicas** e clique em **Permitir**. Sem isso o celular não conecta.

## Usar no dia a dia

1. **Dois cliques no ícone “Projetor Durães”** na Área de Trabalho. O telão abre numa janela. Arraste para o projetor e aperte **F11**. A janela preta que aparece (pode minimizar) precisa ficar aberta.
2. **No celular**, aponte a câmera para o QR code do telão (no canto) e abra o link. Depois **coloque o ícone “Telão” na tela do celular** (toque em 📱 no canto de cima do app; tem o passo a passo para iPhone e Android). Da próxima vez é só tocar no ícone.

O celular e o computador precisam estar **no mesmo Wi-Fi**.

## O app do celular

Quatro botões embaixo:

- **📅 Dias**: uma lista para cada dia, de segunda a domingo. Abre no dia de hoje. Toque no **▶** de um item e ele vai para o telão. Toque no nome para ver os slides ou as estrofes e escolher um. Quando o dia tem mais de um tipo de coisa, aparecem filtros logo abaixo do título (**Tudo · Slides · Vídeos · Áudios · Links · Músicas**, cada um com a quantidade) para separar, por exemplo, só os slides ou só os vídeos daquele dia. A ordem do dia é uma só: **Avançar** continua seguindo ela, e **Subir / Descer** (no ⋯) respeitam o filtro escolhido.
- **🎵 Músicas**: todas as músicas, com busca por nome ou trecho da letra.
- **🗂 Mídia**: tudo o que foi enviado (slides, vídeos, áudios, links), com filtro.
- **＋ Adicionar**: PDF ou imagens, vídeo ou áudio, link, música e tela do computador.

Em cima fica sempre o que está **no ar**, com a prévia, os botões grandes **Voltar / Avançar**, **Tela preta**, **Tirar do ar** e o volume (para vídeo, áudio, YouTube e sites).

Em cada item, o botão **⋯** abre as opções: subir e descer na lista, tirar do dia, mostrar em outros dias, copiar alguns slides para outros dias, editar a letra e apagar.

### Adicionar

- **PDF ou imagens**: o PDF vira slides numerados sozinho, na ordem. Escolha o dia em **Adicionar em** e ele já entra na lista daquele dia.
- **Vídeo ou áudio**: MP4, MOV, WEBM, MP3, M4A, WAV, OGG, AAC, FLAC. O volume é pelo celular.
- **Link**:
  - **YouTube** (vídeo ou ao vivo): toca direto no telão. Funcionam os links `youtube.com/watch`, `youtu.be`, `youtube.com/live` e `shorts`.
  - **Outros sites, como o Univer Vídeo**: o programa **abre o site sozinho em tela cheia no computador** (no monitor do telão) e você controla **volume e silenciar** pelo celular. Ninguém precisa ir até o computador, clicar em aba nem duplicar a tela.
- **Música**: cole a letra. Deixe uma linha em branco entre as estrofes: cada estrofe vira uma tela.
- **Tela do computador**: mostra uma aba ou janela qualquer do computador no telão.

### Sites em tela cheia (Univer etc.)

Ao tocar no ▶ de um link de site, o programa abre **uma janela do Chrome ou Edge em tela cheia** (no mesmo monitor do telão, se ele estiver aberto) e carrega a página. **Tirar do ar** fecha a janela. Volume e silenciar valem para os vídeos da página, mesmo quando o player fica dentro de outro quadro.

**Login (Univer):** o site abre num navegador **do próprio programa**, com perfil guardado na pasta `dados-navegador`. Na **primeira vez**, o site vai pedir login: **entre pelo computador, de preferência antes do culto** (a tela do computador aparece no telão). Marque "Manter conectado" se houver. Depois o login fica salvo. O programa nunca vê nem guarda a senha. A pasta `dados-navegador` guarda a sessão: **não compartilhe nem coloque em lugar público**.

Se alguma página não começar a tocar sozinha, ou se aparecer um aviso do site, dá para clicar nela com o mouse do computador. Se a imagem aparecer **preta** mas o som vier, o site bloqueia a captura; nesse caso, me avise.

**Sem Chrome nem Edge** (ou se a janela não abrir), o programa abre a página no navegador padrão e o telão pede para escolher a janela (captura de tela), como na **Tela do computador** abaixo.

### Tela do computador (qualquer aba ou janela)

O item fixo **🖥️ Tela do computador** (＋ Adicionar) mostra uma aba ou janela qualquer. O navegador exige que **alguém clique no telão e escolha a janela** uma vez (Chrome ou Edge: **Guia** ou **Janela** → escolha → marque **“Compartilhar áudio da guia”** → Compartilhar). O som da aba sai só pelo telão, e o volume e o **🔇 Silenciar** ficam no celular. O telão precisa estar em `http://localhost:8080/telao.html` (é o que o ícone abre).

## Pastas no computador

Ao abrir, o programa cria a pasta `Pastas do Projetor`:

```
Pastas do Projetor/
  0 - Geral (sem dia)    1 - Segunda    2 - Terça     3 - Quarta
  4 - Quinta             5 - Sexta      6 - Sábado    7 - Domingo
  9 - Fundo da tela
```

Coloque o arquivo na pasta do dia (PDF, imagens, vídeo, áudio). Em poucos segundos ele aparece no celular, já convertido e na lista daquele dia. O original continua na pasta. No celular, **Mídia → 📁 Abrir as pastas no computador** abre essa janela no PC.

**Fundo da tela**: quando nada está no ar, o telão mostra um fundo azul. Para trocar, coloque uma imagem em `9 - Fundo da tela` (vale a mais recente).

## Bíblia

O programa **não traz texto bíblico**: ele lê o arquivo da versão que a igreja tem permissão de usar (ARC, NVI, NTLH…).

1. Coloque o arquivo em `Pastas do Projetor/8 - Bíblias` (o nome do arquivo vira o nome da versão, ex.: `ARC.csv`), **ou** na aba Bíblia do celular, menu ⋯ → *Enviar arquivo da Bíblia*.
2. Formatos aceitos: CSV (`livro;capitulo;versiculo;texto`), JSON, XML (Zefania) e TXT.
3. Na aba Bíblia escolha livro, capítulo e toque no versículo: ele aparece no telão com a referência em dourado. *Avançar/Voltar* passam os versículos. Também dá para digitar "jo 3:16" ou uma palavra.

## Salvar e atualizar

- **Fica salvo** no disco do computador, mesmo se desligar: slides, vídeos, áudios, músicas, links, as listas de cada dia e os arquivos das pastas. **Não fica salvo**: o que está no ar agora, tela preta e volume.
- Tudo está em três pastas: **`biblioteca`**, **`Pastas do Projetor`** e **`dados-navegador`** (o login dos sites, como o Univer). **Copie-as de vez em quando para um pen drive** (se o computador quebrar, perde-se tudo). A `dados-navegador` tem a sessão logada: guarde só em lugar seguro.
- **Para atualizar**: feche a janela preta, baixe o ZIP novo, **copie para ele as três pastas** acima e abra o `iniciar-windows.bat`. Faça isso fora do culto (o telão volta ao fundo azul por uns segundos). Se a versão nova precisar de componentes novos, o programa instala sozinho.
- **Apagar** remove o arquivo de vez. **Tirar deste dia** e **Limpar o dia** só tiram da lista; o arquivo continua na aba Mídia.

## Vários celulares e ícone

Vários celulares podem controlar ao mesmo tempo. Em **📱** (no topo do app) há o QR code para conectar outro celular, a contagem de celulares conectados e o botão para mostrar o QR no telão.

O ícone guarda o **endereço do computador** na rede (ex.: `http://192.168.0.10:8080`). Se o roteador der outro número ao computador, o ícone para de achar o telão. Para evitar, peça para quem cuida da internet **reservar um IP fixo para esse computador** no roteador. No iPhone, o endereço com o nome do computador (`http://nome.local:8080`, mostrado na mesma tela) pode ajudar. Se mudar mesmo assim, é só ler o QR de novo e recolocar o ícone.

## Segurança

Não há senha: qualquer aparelho no mesmo Wi-Fi que abrir o endereço consegue controlar o telão, mandar arquivos e abrir páginas no computador. Use numa rede da igreja em que você confia.

## Para desenvolvedores

```bash
npm install
npm start     # http://localhost:8080 (mude com PORTA=9000)
npm test
node scripts/gerar-icones.mjs   # gera os ícones (celular e Windows)
```

- `server.js` inicia o servidor. `src/`: PDF (`pdf.js`), biblioteca (`biblioteca.js`), estado e comandos (`estado.js`), pastas dos dias (`pastas.js`), YouTube (`youtube.js`), sites (`site.js`), janela de site em tela cheia (`navegador.js`), abrir coisas no computador (`abrir.js`), servidor HTTP/WebSocket (`servidor.js`).
- `public/`: telão (`telao.html`) e app do celular (`controle.html`).
- `iniciar-windows.bat`, `criar-atalho-windows.bat` e `iniciar-mac.command` abrem o programa.

## Próximas etapas

1. Bíblia (precisa do arquivo de uma versão que a igreja tenha licença para usar).
2. Aba de avisos e pastas de vídeo.
3. Lembrar o que estava no telão depois de reiniciar.
