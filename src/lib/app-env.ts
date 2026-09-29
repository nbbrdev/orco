// Ambiente do app, definido por nós (e não pela plataforma), igual em qualquer hospedagem
// (ADR-0012). Veja docs/06-regras-dev.md §8.
export const APP_ENVS = ["development", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

/** Lê `APP_ENV`. Ausente = `development` (máquina local); valor desconhecido = erro. */
export function getAppEnv(value: string | undefined = process.env.APP_ENV): AppEnv {
  if (value === undefined || value === "") {
    return "development";
  }
  if (!isAppEnv(value)) {
    throw new Error(`APP_ENV inválido: "${value}". Use ${APP_ENVS.join(", ")}.`);
  }
  return value;
}
