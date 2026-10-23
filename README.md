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

- **📅 Dias**: uma lista para cada dia, de segunda a domingo. Abre no dia de hoje. Toque no **▶** de um item e ele vai para o telão. Toque no nome para ver os slides ou as estrofes e escolher um.
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
  - **Outros sites, como o Univer Vídeo**: o site abre no computador e o telão pede para escolher a janela dele (uma vez). O som sai só pelo telão, com o volume pelo celular.
- **Música**: cole a letra. Deixe uma linha em branco entre as estrofes: cada estrofe vira uma tela.
- **Tela do computador**: mostra uma aba ou janela qualquer do computador no telão.

### Tela do computador e sites (Univer etc.)

O navegador exige que **alguém clique no telão e escolha a janela** uma vez. No Chrome ou Edge: **Guia** (ou **Janela**) → escolha a aba → marque **“Compartilhar áudio da guia”** → Compartilhar. O som da aba sai só pelo telão, e o volume e o **🔇 Silenciar** ficam no celular. Depois, trocar de item e voltar não pede de novo.

O telão precisa estar em `http://localhost:8080/telao.html` (é o que o ícone abre). Em outro endereço o navegador não libera a captura.

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

## Salvar e atualizar

- **Fica salvo** no disco do computador, mesmo se desligar: slides, vídeos, áudios, músicas, links, as listas de cada dia e os arquivos das pastas. **Não fica salvo**: o que está no ar agora, tela preta e volume.
- Tudo está em duas pastas, **`biblioteca`** e **`Pastas do Projetor`**. **Copie-as de vez em quando para um pen drive ou Drive** (se o computador quebrar, perde-se tudo).
- **Para atualizar**: feche a janela preta, baixe o ZIP novo, **copie para ele as duas pastas** acima e abra o `iniciar-windows.bat`. Faça isso fora do culto (o telão volta ao fundo azul por uns segundos). Se a versão nova precisar de componentes novos, o programa instala sozinho.
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

- `server.js` inicia o servidor. `src/`: PDF (`pdf.js`), biblioteca (`biblioteca.js`), estado e comandos (`estado.js`), pastas dos dias (`pastas.js`), YouTube (`youtube.js`), sites (`site.js`), abrir coisas no computador (`abrir.js`), servidor HTTP/WebSocket (`servidor.js`).
- `public/`: telão (`telao.html`) e app do celular (`controle.html`).
- `iniciar-windows.bat`, `criar-atalho-windows.bat` e `iniciar-mac.command` abrem o programa.

## Próximas etapas

1. Bíblia (precisa do arquivo de uma versão que a igreja tenha licença para usar).
2. Aba de avisos e pastas de vídeo.
3. Lembrar o que estava no telão depois de reiniciar.
