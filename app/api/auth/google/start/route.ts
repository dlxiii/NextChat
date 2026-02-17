import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";
import {
  createOAuthNonce,
  encodeOAuthState,
  pickAuthorizationUrl,
} from "../../oauth-utils";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");
const OAUTH_STATE_COOKIE = "hexagram-google-oauth-state";

/**
 * Google OAuth 起始端点：
 * 1) 生成 state（携带 nonce + remember）并写入服务端 cookie。
 * 2) 请求上游认证服务生成 Google 授权地址。
 * 3) 将浏览器重定向到 Google 授权页。
 */
export async function GET(req: NextRequest) {
  const remember = req.nextUrl.searchParams.get("remember") === "1";
  const nonce = createOAuthNonce();
  const state = encodeOAuthState({ nonce, remember });

  cookies().set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  });

  const callbackUrl = new URL("/api/auth/google/callback", req.nextUrl.origin);

  const upstreamUrl = new URL(`${AUTH_BASE_URL}/api/auth/google/start`);
  upstreamUrl.searchParams.set("state", state);
  upstreamUrl.searchParams.set("redirect_uri", callbackUrl.toString());

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });

  const bodyText = await upstreamRes.text();
  const authorizationUrl = pickAuthorizationUrl(upstreamRes, bodyText);

  if (!authorizationUrl) {
    return NextResponse.json(
      { error: true, message: "Failed to get Google authorization url" },
      { status: 502 },
    );
  }

  return NextResponse.redirect(authorizationUrl);
}
