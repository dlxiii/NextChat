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
 * Google OAuth 起始端点。
 *
 * 兼容性背景：线上不同版本认证服务可能提供不同的 Google 启动路径
 * （例如 `/api/auth/google/start` 或 `/api/auth/google`）。
 *
 * 实现流程：
 * 1) 生成 nonce + remember 并编码到 state。
 * 2) 将 nonce 放入 HttpOnly cookie，用于回调阶段 CSRF 校验。
 * 3) 依次尝试多个上游启动端点；每次都透传 state/redirect_uri。
 * 4) 一旦提取到授权地址，立即 302 跳转；否则返回 502。
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

  /**
   * 端点回退策略：
   * - 新路径：/api/auth/google/start
   * - 旧/兼容路径：/api/auth/google
   */
  const upstreamCandidates = [
    `${AUTH_BASE_URL}/api/auth/google/start`,
    `${AUTH_BASE_URL}/api/auth/google`,
  ];

  for (const candidate of upstreamCandidates) {
    const upstreamUrl = new URL(candidate);
    // 常见参数命名全部携带，提高对上游实现差异的兼容性。
    upstreamUrl.searchParams.set("state", state);
    upstreamUrl.searchParams.set("redirect_uri", callbackUrl.toString());
    upstreamUrl.searchParams.set("redirectUri", callbackUrl.toString());
    upstreamUrl.searchParams.set("callbackUrl", callbackUrl.toString());

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" },
    });

    const bodyText = await upstreamRes.text();
    const authorizationUrl = pickAuthorizationUrl(upstreamRes, bodyText);
    if (authorizationUrl) {
      return NextResponse.redirect(authorizationUrl);
    }
  }

  return NextResponse.json(
    { error: true, message: "Failed to get Google authorization url" },
    { status: 502 },
  );
}
