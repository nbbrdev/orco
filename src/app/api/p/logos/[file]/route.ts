import { LOGO_FILE_PATTERN } from "@/features/profile/logo-rules";
import { getObject } from "@/lib/storage";

// Logo do freelancer (NBB-81, L4): público para quem tem o endereço, porque aparece na página do
// orçamento e no PDF. O nome é um UUID gerado pelo servidor, impossível de adivinhar, e não revela a
// conta. Fica sob /api/p/, liberado do Basic Auth no staging, como a página pública.

const CONTENT_TYPES = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" } as const;

export async function GET(_request: Request, { params }: RouteContext<"/api/p/logos/[file]">) {
  const { file } = await params;
  const match = LOGO_FILE_PATTERN.exec(file);
  if (!match) {
    return new Response("Não encontrado.", { status: 404 });
  }

  const bytes = await getObject(file);
  if (!bytes) {
    return new Response("Não encontrado.", { status: 404 });
  }

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[match[1] as keyof typeof CONTENT_TYPES],
      // Trocar o logo gera outro nome, então este arquivo nunca muda.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
