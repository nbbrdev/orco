// "Baixar PDF" no navegador (RN-22, NBB-51 P2-A): pede o PDF por POST e salva o arquivo com o nome
// que o servidor mandou (F-06). Usado pelo editor e pelo modo leitura (NBB-53 M3-A); no aprovado e no
// recusado, o POST não muda o status.

/** Baixa o PDF do orçamento. Devolve a mensagem de erro, ou `null` se deu certo. */
export async function downloadQuotePdf(quoteId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/orcamentos/${quoteId}/pdf`, { method: "POST" });
    if (!response.ok) {
      return await response.text();
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "Orcamento.pdf";
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  } catch {
    return "Não foi possível baixar o PDF. Tente de novo.";
  }
}
