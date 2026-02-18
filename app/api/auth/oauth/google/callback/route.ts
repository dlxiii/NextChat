import { NextRequest } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");

/**
 * Proxies the Google OAuth callback request to the external auth service.
 *
 * Security boundary:
 * - The external auth service owns `state` (and optional PKCE) verification.
 * - NextChat only forwards callback query/cookies and normalizes headers.
 * - We never log callback query values to avoid leaking authorization codes.
 *
 * Compatibility:
 * - Existing email/password login/register routes are untouched.
 * - Callback responses are passed through as-is so backend can choose JSON or redirect.
 *
 * @param req Incoming callback request with provider query params.
 * @returns Proxied callback response from external auth service.
 */
async function proxyGoogleOAuthCallback(req: NextRequest) {
  const callbackUrl = new URL(
    `${AUTH_BASE_URL}/api/auth/oauth/google/callback`,
  );

  // Preserve all callback params (code/state/error) without re-encoding mistakes.
  req.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.append(key, value);
  });

  const response = await fetch(callbackUrl.toString(), {
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
  return proxyGoogleOAuthCallback(req);
}
