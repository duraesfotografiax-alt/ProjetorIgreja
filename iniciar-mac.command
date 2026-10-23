#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "O Node.js não está instalado. Baixe em https://nodejs.org e instale a versão LTS."
  read -r -p "Aperte Enter para fechar."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Instalando pela primeira vez, aguarde..."
  npm install --omit=dev
fi
node server.js --abrir
