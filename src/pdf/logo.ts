import sharp from "sharp";

// O logo fica guardado em WebP (RN-05, NBB-81 L2), mas o react-pdf só lê PNG e JPEG. Na hora do PDF,
// o servidor converte para PNG, que mantém a transparência (NBB-50 N1-A). A imagem já chega reduzida
// a no máximo 1024 px, então a conversão é rápida.

/** Converte o logo (WebP, PNG ou JPEG) em PNG. Nulo se o arquivo não for uma imagem válida. */
export async function logoToPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await sharp(bytes).png().toBuffer());
  } catch {
    return null;
  }
}
