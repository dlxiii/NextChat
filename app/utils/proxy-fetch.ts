import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { HttpsProxyAgent } from "https-proxy-agent";

function normalizeHeaders(headers: HeadersInit | undefined) {
  const normalized: Record<string, string> = {};

  if (!headers) return normalized;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      normalized[key] = value;
    }
    return normalized;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * Execute outbound HTTP requests with optional HTTPS proxy fallback.
 *
 * Why this helper exists:
 * 1) Node's built-in `fetch` in our runtime may not honor `HTTPS_PROXY` automatically,
 *    which can break server-to-server auth calls in restricted networks.
 * 2) For ordinary environments, we still prefer native `fetch` for streaming and
 *    standards-compliant behavior.
 * 3) When native `fetch` fails with a network-level error, we retry through
 *    `HttpsProxyAgent` using Node's low-level request APIs.
 */
export async function fetchWithOptionalProxy(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy;

    if (!proxyUrl) {
      throw error;
    }

    const targetUrl = new URL(input);
    const requestImpl =
      targetUrl.protocol === "http:" ? httpRequest : httpsRequest;
    const headers = normalizeHeaders(init.headers);
    const body =
      typeof init.body === "string"
        ? init.body
        : init.body
        ? String(init.body)
        : undefined;

    return await new Promise<Response>((resolve, reject) => {
      const req = requestImpl(
        targetUrl,
        {
          method: init.method,
          headers,
          agent: new HttpsProxyAgent(proxyUrl),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value === undefined) continue;
              responseHeaders.set(
                key,
                Array.isArray(value) ? value.join(", ") : String(value),
              );
            }

            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode ?? 500,
                statusText: res.statusMessage,
                headers: responseHeaders,
              }),
            );
          });
        },
      );

      req.on("error", reject);

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }
}
