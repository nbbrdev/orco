import { createHash, timingSafeEqual } from "node:crypto";

// Proteção do staging por HTTP Basic Auth (docs/07-seguranca.md §10.2).

// Rotas que ficam abertas mesmo no staging: o link público do orçamento e o PDF (para testar como
// um cliente, sem senha) e os arquivos do PWA, que o navegador busca sem mostrar a janela de senha.
const PUBLIC_PREFIXES = ["/p/", "/api/p/"];
const PUBLIC_FILES = ["/sw.js", "/manifest.webmanifest"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_FILES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

// Compara em tempo constante: o tempo de resposta não revela quantos caracteres estavam certos.
// O hash iguala o tamanho dos dois lados, exigência do `timingSafeEqual`.
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Confere o header `Authorization: Basic <base64(usuario:senha)>` contra as credenciais esperadas. */
export function isAuthorized(
  authorization: string | null,
  expectedUser: string,
  expectedPassword: string,
): boolean {
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  // O usuário não pode conter ":"; a senha pode (RFC 7617).
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  // Avalia os dois lados sempre, sem curto-circuito, para não vazar qual deles errou.
  const userOk = safeEqual(user, expectedUser);
  const passwordOk = safeEqual(password, expectedPassword);
  return userOk && passwordOk;
}
