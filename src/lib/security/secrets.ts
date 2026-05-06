export function getRequiredSecret(name: string, value: string) {
  if (!value || value.startsWith("your-") || value.startsWith("generate-")) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  return scheme.toLowerCase() === "bearer" && token ? token : "";
}
