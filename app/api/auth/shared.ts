export const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readAuthBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return null;
  const raw = await request.text();
  if (!raw || raw.length > 4_096) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function authError(code: string, status: number, field?: string) {
  return Response.json(
    { error: { code, ...(field ? { field } : {}) } },
    { status, headers: NO_STORE_HEADERS },
  );
}
