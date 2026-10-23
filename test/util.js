// Monta um PDF mínimo e válido com N páginas de texto, sem dependências.
export function criarPdf(paginas) {
  const objetos = [];
  const add = (corpo) => { objetos.push(corpo); return objetos.length; };

  const catalogo = add(null);
  const raiz = add(null);
  const fonte = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const filhos = paginas.map((texto) => {
    const conteudo = `BT /F1 60 Tf 100 250 Td (${texto}) Tj ET`;
    const stream = add(`<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
    return add(`<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 960 540] ` +
      `/Resources << /Font << /F1 ${fonte} 0 R >> >> /Contents ${stream} 0 R >>`);
  });
  objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${raiz} 0 R >>`;
  objetos[raiz - 1] = `<< /Type /Pages /Kids [${filhos.map((f) => `${f} 0 R`).join(' ')}] /Count ${filhos.length} >>`;

  let saida = '%PDF-1.4\n';
  const posicoes = objetos.map((corpo, i) => {
    const pos = saida.length;
    saida += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
    return pos;
  });
  const xref = saida.length;
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  saida += posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}
