export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
