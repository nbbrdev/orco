// Robôs de pré-visualização (RN-35, NBB-53 P2-A). Quando alguém cola o link no WhatsApp, no Telegram
// ou num e-mail, o servidor desses apps abre a página para montar a prévia. Essas aberturas não podem
// virar "Cliente visualizou". A lista é nossa, pelo user agent, e cobre os apps mais comuns no Brasil
// e os buscadores; o resto cai nas palavras genéricas do fim.

const PREVIEW_BOTS = [
  /whatsapp/i,
  /telegrambot/i,
  /slackbot|slack-imgproxy/i,
  /facebookexternalhit|facebot|meta-externalagent/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /googlebot|google-inspectiontool|googleother|apis-google/i,
  /bingbot|bingpreview/i,
  // iMessage monta a prévia com um user agent de Facebook + Twitter; o Applebot é o buscador.
  /applebot/i,
  /skypeuripreview/i,
  /pinterestbot/i,
  /redditbot/i,
  /embedly|iframely/i,
  /\b(bot|crawler|spider|preview)\b/i,
];

/** Se quem abriu a página é um robô de pré-visualização ou de busca. Sem user agent, também. */
export function isPreviewBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return PREVIEW_BOTS.some((pattern) => pattern.test(userAgent));
}
