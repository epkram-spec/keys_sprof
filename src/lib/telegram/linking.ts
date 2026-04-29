export function createTelegramStartToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildTelegramStartUrl(botUsername: string, token: string) {
  return `https://t.me/${botUsername}?start=${token}`;
}
