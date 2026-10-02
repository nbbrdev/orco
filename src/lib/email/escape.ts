// Escape de texto para dentro do HTML dos e-mails (ADR-0016). Todo valor variável (e-mail, link) passa
// por aqui antes de entrar no HTML: um e-mail como `<script>@x.com` vira texto, nunca código.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
