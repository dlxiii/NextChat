import { NextRequest } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");

/**
 * Proxies the Google OAuth start request to the external auth service.
 *
 * Design notes:
 * - NextChat intentionally stays as a thin gateway so OAuth state/PKCE generation,
 *   Google token exchange, and account binding remain centralized in the auth backend.
 * - We forward cookies and user-agent metadata required by the backend while removing
 *   headers that can trigger browser auth popups in proxied responses.
 *
 * @param req Incoming browser request to /api/auth/oauth/google/start.
 * @returns A proxied response (typically 302 redirect to Google consent page).
 */
async function proxyGoogleOAuthStart(req: NextRequest) {
  const response = await fetch(`${AUTH_BASE_URL}/api/auth/oauth/google/start`, {
    method: "GET",
    headers: {
      Accept: req.headers.get("Accept") ?? "*/*",
      "User-Agent": req.headers.get("User-Agent") ?? "",
      Cookie: req.headers.get("Cookie") ?? "",
      "X-Forwarded-For": req.headers.get("X-Forwarded-For") ?? "",
      "X-Forwarded-Proto": req.headers.get("X-Forwarded-Proto") ?? "",
      "X-Forwarded-Host": req.headers.get("X-Forwarded-Host") ?? "",
    },
    redirect: "manual",
  });

  const headers = new Headers(response.headers);
  headers.delete("www-authenticate");
  headers.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(req: NextRequest) {
  return proxyGoogleOAuthStart(req);
}
