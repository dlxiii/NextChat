import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";
import { decodeOAuthState, pickSessionPayload } from "../../oauth-utils";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");
const OAUTH_STATE_COOKIE = "hexagram-google-oauth-state";
const OAUTH_SESSION_COOKIE = "hexagram-google-oauth-session";

/**
 * Google OAuth 回调端点：
 *
 * 实现流程说明：
 * 1) 验证 state 与 cookie nonce 是否匹配，阻断 CSRF。
 * 2) 将 query 原样转发给上游 `/api/auth/google/callback`，由上游完成 code 换 token。
 * 3) 把 token payload 以 HttpOnly cookie 临时落地，避免把 access token 暴露到 URL。
 * 4) 跳转到 `/#/auth`，由前端调用 `/api/auth/oauth-session` 拉取并持久化会话。
 */
export async function GET(req: NextRequest) {
  const parsedState = decodeOAuthState(req.nextUrl.searchParams.get("state"));
  const nonceCookie = cookies().get(OAUTH_STATE_COOKIE)?.value;

  if (!parsedState || !nonceCookie || parsedState.nonce !== nonceCookie) {
    cookies().delete(OAUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/#/auth?oauth_error=state", req.url));
  }

  const upstreamUrl = new URL(`${AUTH_BASE_URL}/api/auth/google/callback`);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });

  const bodyText = await upstreamRes.text();
  const payload = pickSessionPayload(bodyText);
  cookies().delete(OAUTH_STATE_COOKIE);

  if (!payload) {
    return NextResponse.redirect(
      new URL("/#/auth?oauth_error=callback", req.url),
    );
  }

  const response = NextResponse.redirect(
    new URL("/#/auth?oauth=google", req.url),
  );
  response.cookies.set(OAUTH_SESSION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 3 * 60,
  });
  response.cookies.set(
    "hexagram-google-oauth-remember",
    parsedState.remember ? "1" : "0",
    {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 3 * 60,
    },
  );
  return response;
}
