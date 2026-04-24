import type { Request, Response } from "express";

const FLASK_BACKEND_URL = (process.env.FLASK_BACKEND_URL || "http://localhost:9786").replace(/\/+$/, "");

export async function proxyFlask(
  req: Request,
  res: Response,
  flaskPath: string,
  overrideMethod?: string,
  overrideBody?: unknown,
): Promise<void> {
  const method = (overrideMethod ?? req.method).toUpperCase();
  const url = `${FLASK_BACKEND_URL}/api${flaskPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const apiKey = req.headers["x-api-key"];
  if (apiKey) headers["x-api-key"] = String(apiKey);

  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody
    ? JSON.stringify(overrideBody ?? req.body ?? {})
    : undefined;

  try {
    const upstream = await fetch(url, { method, headers, body });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text || null;
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    req.log?.error?.({ err }, "Flask proxy error");
    res.status(502).json({ error: "Flask backend unreachable" });
  }
}
