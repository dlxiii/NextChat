import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { HEXAGRAM_BASE_URL } from "@/app/constant";
import { decodeOAuthState, pickSessionPayload } from "../../oauth-utils";

const AUTH_BASE_URL = HEXAGRAM_BASE_URL.replace(/\/$/, "");
const OAUTH_STATE_COOKIE = "hexagram-google-oauth-state";
const OAUTH_SESSION_COOKIE = "hexagram-google-oauth-session";

/**
 * Google OAuth 回调端点。
 *
 * 实现流程说明：
 * 1) 校验 state 与 nonce cookie，阻断 CSRF。
 * 2) 将 callback query 转发到上游换 token（兼容多个上游回调路径）。
 * 3) 将会话结果写入短时 HttpOnly cookie，随后重定向到 /#/auth。
 */
export async function GET(req: NextRequest) {
  const parsedState = decodeOAuthState(req.nextUrl.searchParams.get("state"));
  const nonceCookie = cookies().get(OAUTH_STATE_COOKIE)?.value;

  if (!parsedState || !nonceCookie || parsedState.nonce !== nonceCookie) {
    cookies().delete(OAUTH_STATE_COOKIE);
    return NextResponse.redirect(new URL("/#/auth?oauth_error=state", req.url));
  }

  const upstreamCandidates = [
    `${AUTH_BASE_URL}/api/auth/google/callback`,
    `${AUTH_BASE_URL}/api/auth/google`,
  ];

  let payload: ReturnType<typeof pickSessionPayload> = null;

  for (const candidate of upstreamCandidates) {
    const upstreamUrl = new URL(candidate);
    req.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value);
    });

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" },
    });

    const bodyText = await upstreamRes.text();
    payload = pickSessionPayload(bodyText);
    if (payload) break;
  }

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
