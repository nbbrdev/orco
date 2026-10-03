"use client";

// Imagem do logo (NBB-81). Se o arquivo não existir mais (ex.: VPS perdida, o RustFS fica fora do
// backup, ADR-0015), avisa com `onMissing` e quem usa trata como "sem logo", em vez de mostrar uma
// imagem quebrada. A pessoa então envia de novo.
export function LogoImage({
  src,
  alt,
  className,
  onMissing,
}: {
  src: string;
  alt: string;
  className?: string;
  onMissing: () => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagem da nossa própria rota, já pequena
    <img
      src={src}
      alt={alt}
      className={className}
      onError={onMissing}
      // O erro pode acontecer antes de o React assumir a página (imagem vinda do servidor): aí o
      // onError não dispara, então confere também quando o elemento é ligado.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) onMissing();
      }}
    />
  );
}
