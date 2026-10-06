// Gerador de PDF a partir de blocos estruturados.
//
// Por que blocos e nao HTML: nao existe navegador dentro de uma Edge Function,
// entao nao da para renderizar HTML. Com blocos (titulo, paragrafo, lista,
// campos, assinatura) o layout e previsivel e o texto sai SELECIONAVEL no PDF
// -- nao e imagem. Fonte padrao Times, que cobre a acentuacao do portugues.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "campos"; itens: Array<{ rotulo: string; valor: string }> }
  | { tipo: "tabela"; colunas: Array<{ titulo: string; largura: number; alinhar?: "esq" | "dir" | "centro" }>;
      linhas: string[][]; destacar?: number[] }
  | { tipo: "espaco"; altura?: number }
  | { tipo: "assinatura"; quem: string; nome?: string };

const A4_RETRATO: [number, number] = [595.28, 841.89];
const A4_PAISAGEM: [number, number] = [841.89, 595.28];
let A4: [number, number] = A4_RETRATO;
const MARGEM = 56;
let LARGURA = A4[0] - MARGEM * 2;
const TAMANHO = 10.5;
const ENTRELINHA = 15;
const RODAPE = 56;

/** Quebra o texto na largura util, respeitando palavras. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual ? atual + " " + palavra : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

export async function gerarPdf(opcoes: {
  titulo: string;
  blocos: Bloco[];
  rodape?: string;
  paisagem?: boolean;
}): Promise<Uint8Array> {
  A4 = opcoes.paisagem ? A4_PAISAGEM : A4_RETRATO;
  LARGURA = A4[0] - MARGEM * 2;
  const doc = await PDFDocument.create();
  doc.setTitle(opcoes.titulo);
  doc.setProducer("Portal Feitoria");

  const normal = await doc.embedFont(StandardFonts.TimesRoman);
  const negrito = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italico = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let pagina: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGEM;
  const paginas: PDFPage[] = [pagina];

  const novaPagina = () => {
    pagina = doc.addPage(A4);
    paginas.push(pagina);
    y = A4[1] - MARGEM;
  };
  const garantir = (altura: number) => { if (y - altura < RODAPE) novaPagina(); };

  const escrever = (texto: string, fonte: PDFFont, tamanho: number, recuo = 0) => {
    for (const linha of quebrar(texto, fonte, tamanho, LARGURA - recuo)) {
      garantir(ENTRELINHA);
      pagina.drawText(linha, { x: MARGEM + recuo, y, size: tamanho, font: fonte });
      y -= ENTRELINHA;
    }
  };

  for (const bloco of opcoes.blocos) {
    switch (bloco.tipo) {
      case "titulo": {
        garantir(48);
        y -= 8;
        for (const linha of quebrar(bloco.texto.toUpperCase(), negrito, 13, LARGURA)) {
          const largura = negrito.widthOfTextAtSize(linha, 13);
          pagina.drawText(linha, { x: (A4[0] - largura) / 2, y, size: 13, font: negrito });
          y -= 18;
        }
        y -= 14;
        break;
      }
      case "subtitulo":
        garantir(30);
        y -= 8;
        escrever(bloco.texto, negrito, 11);
        y -= 4;
        break;

      case "paragrafo":
        escrever(bloco.texto, normal, TAMANHO);
        y -= 8;
        break;

      case "lista":
        for (const item of bloco.itens) {
          garantir(ENTRELINHA);
          pagina.drawText("•", { x: MARGEM + 6, y, size: TAMANHO, font: normal });
          escrever(item, normal, TAMANHO, 22);
          y -= 4;
        }
        y -= 6;
        break;

      case "campos":
        for (const { rotulo, valor } of bloco.itens) {
          garantir(ENTRELINHA);
          const etiqueta = rotulo + ": ";
          pagina.drawText(etiqueta, { x: MARGEM, y, size: TAMANHO, font: negrito });
          const recuo = negrito.widthOfTextAtSize(etiqueta, TAMANHO);
          const linhas = quebrar(valor || "—", normal, TAMANHO, LARGURA - recuo);
          pagina.drawText(linhas[0] ?? "", { x: MARGEM + recuo, y, size: TAMANHO, font: normal });
          y -= ENTRELINHA;
          for (const extra of linhas.slice(1)) {
            garantir(ENTRELINHA);
            pagina.drawText(extra, { x: MARGEM + recuo, y, size: TAMANHO, font: normal });
            y -= ENTRELINHA;
          }
        }
        y -= 8;
        break;

      case "tabela": {
        const totalPeso = bloco.colunas.reduce((a, c) => a + c.largura, 0);
        const larguras = bloco.colunas.map((c) => (c.largura / totalPeso) * LARGURA);
        const alturaLinha = 13;
        const tamanhoTab = 8;

        const cabecalho = () => {
          garantir(alturaLinha * 2);
          let x = MARGEM;
          pagina.drawRectangle({
            x: MARGEM, y: y - 3, width: LARGURA, height: alturaLinha,
            color: rgb(0.92, 0.91, 0.88),
          });
          bloco.colunas.forEach((c, i) => {
            pagina.drawText(c.titulo, { x: x + 3, y, size: tamanhoTab, font: negrito });
            x += larguras[i];
          });
          y -= alturaLinha + 2;
        };

        cabecalho();
        bloco.linhas.forEach((linha, n) => {
          if (y - alturaLinha < RODAPE) { novaPagina(); cabecalho(); }
          if (bloco.destacar?.includes(n)) {
            pagina.drawRectangle({
              x: MARGEM, y: y - 3, width: LARGURA, height: alturaLinha,
              color: rgb(0.95, 0.96, 0.94),
            });
          }
          let x = MARGEM;
          linha.forEach((celula, i) => {
            const fonte = bloco.destacar?.includes(n) ? negrito : normal;
            const texto = String(celula ?? "");
            const alinhar = bloco.colunas[i]?.alinhar ?? "esq";
            const largCelula = larguras[i] - 6;
            let cortado = texto;
            while (fonte.widthOfTextAtSize(cortado, tamanhoTab) > largCelula && cortado.length > 1) {
              cortado = cortado.slice(0, -1);
            }
            const larg = fonte.widthOfTextAtSize(cortado, tamanhoTab);
            const px = alinhar === "dir" ? x + larguras[i] - larg - 3
                     : alinhar === "centro" ? x + (larguras[i] - larg) / 2
                     : x + 3;
            pagina.drawText(cortado, { x: px, y, size: tamanhoTab, font: fonte });
            x += larguras[i];
          });
          pagina.drawLine({
            start: { x: MARGEM, y: y - 4 }, end: { x: MARGEM + LARGURA, y: y - 4 },
            thickness: 0.3, color: rgb(0.85, 0.84, 0.81),
          });
          y -= alturaLinha;
        });
        y -= 10;
        break;
      }

      case "espaco":
        y -= bloco.altura ?? 20;
        break;

      case "assinatura": {
        garantir(70);
        y -= 28;
        pagina.drawLine({
          start: { x: MARGEM, y }, end: { x: MARGEM + 320, y },
          thickness: 0.8, color: rgb(0.2, 0.2, 0.2),
        });
        y -= 14;
        pagina.drawText(bloco.quem, { x: MARGEM, y, size: 9.5, font: negrito });
        y -= 13;
        if (bloco.nome) {
          pagina.drawText(bloco.nome, { x: MARGEM, y, size: 9.5, font: normal });
          y -= 13;
        }
        y -= 6;
        break;
      }
    }
  }

  // Rodape com numeracao, em todas as paginas.
  const total = paginas.length;
  paginas.forEach((p, i) => {
    const texto = `${opcoes.rodape ?? ""}${opcoes.rodape ? "  ·  " : ""}Página ${i + 1} de ${total}`;
    const largura = italico.widthOfTextAtSize(texto, 8);
    p.drawText(texto, {
      x: (A4[0] - largura) / 2, y: 34, size: 8, font: italico,
      color: rgb(0.45, 0.45, 0.45),
    });
  });

  return await doc.save();
}
