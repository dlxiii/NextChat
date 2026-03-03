import styles from "./auth-credentials.module.scss";
import { IconButton } from "./button";
import { showToast } from "./ui-lib";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiPath, Path } from "../constant";
import Locale from "../locales";
import LeftIcon from "../icons/left.svg";
import { PasswordInput } from "./ui-lib";
import clsx from "clsx";
import { getAuthSession, persistAuthSession } from "../utils/auth-session";

type AuthLoginPayload = {
  accessToken: string;
  tokenType?: string;
  email?: string;
  userId?: string;
  roles?: string[];
  plan?: string;
};

/**
 * Normalize login API response into a stable local auth session payload.
 *
 * Why this exists:
 * - Different auth backends may return snake_case / camelCase / nested token fields.
 * - We must persist a valid access token before redirecting users to chat,
 *   otherwise users "look logged in" but still fail model requests.
 *
 * Resolution flow:
 * 1) Try reading token fields from the root response object.
 * 2) If not found, retry from common nested containers (`data`, `result`).
 * 3) Return `null` when no token is available so caller can treat login as failed.
 */
function normalizeAuthLoginPayload(
  responseJson: Record<string, unknown> | null,
): AuthLoginPayload | null {
  if (!responseJson) return null;

  const candidates = [
    responseJson,
    (responseJson.data as Record<string, unknown> | undefined) ?? null,
    (responseJson.result as Record<string, unknown> | undefined) ?? null,
  ].filter(Boolean) as Record<string, unknown>[];

  for (const source of candidates) {
    const accessToken =
      (source.access_token as string | undefined) ??
      (source.accessToken as string | undefined) ??
      (source.token as string | undefined);

    if (!accessToken) continue;

    return {
      accessToken,
      tokenType:
        (source.token_type as string | undefined) ??
        (source.tokenType as string | undefined),
      email: source.email as string | undefined,
      userId:
        (source.userId as string | undefined) ??
        (source.user_id as string | undefined),
      roles: source.roles as string[] | undefined,
      plan: source.plan as string | undefined,
    };
  }

  return null;
}

export function AuthCredentialsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    const session = getAuthSession();
    if (session?.accessToken) {
      navigate(Path.Chat);
    }
  }, [navigate]);

  useEffect(() => {
    /**
     * OAuth 会话接管流程：
     * 1) Google 回调后，后端会把 token 暂存在 HttpOnly cookie。
     * 2) 前端进入 /auth 后调用本接口读取该临时会话。
     * 3) 成功后沿用现有账号密码登录的持久化逻辑。
     */
    const consumeOAuthSession = async () => {
      const response = await fetch("/api/auth/oauth-session", {
        method: "GET",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        ok?: boolean;
        remember?: boolean;
        session?: {
          access_token?: string;
          token_type?: string;
          email?: string;
          userId?: string;
          roles?: string[];
          plan?: string;
        };
      };

      if (!data.ok || !data.session?.access_token) return;

      persistAuthSession(
        {
          accessToken: data.session.access_token,
          tokenType: data.session.token_type,
          email: data.session.email,
          userId: data.session.userId,
          roles: data.session.roles,
          plan: data.session.plan,
        },
        Boolean(data.remember),
      );
      showToast(Locale.AuthCredential.Success);
      navigate(Path.Chat);
    };

    void consumeOAuthSession();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "login") {
      if (!email.trim() || !password) {
        showToast(Locale.AuthCredential.Validation);
        return;
      }
    }

    if (mode === "register") {
      if (!email.trim() || !password || !confirmPassword) {
        showToast(Locale.AuthCredential.RegisterValidation);
        return;
      }

      if (password !== confirmPassword) {
        showToast(Locale.AuthCredential.RegisterMismatch);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload =
        mode === "login"
          ? {
              email: email.trim(),
              password,
              remember,
            }
          : {
              email: email.trim(),
              password,
              confirmPassword,
            };

      const endpoint = `${
        mode === "login" ? ApiPath.AuthLogin : ApiPath.AuthRegister
      }`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseJson: Record<string, unknown> | null = null;
      if (responseText) {
        try {
          responseJson = JSON.parse(responseText);
        } catch (error) {
          console.warn("[Auth] Failed to parse auth response", error);
        }
      }

      if (!response.ok) {
        throw new Error(responseText);
      }

      const normalizedLoginPayload = normalizeAuthLoginPayload(responseJson);

      if (mode === "login" && normalizedLoginPayload) {
        persistAuthSession(
          {
            accessToken: normalizedLoginPayload.accessToken,
            tokenType: normalizedLoginPayload.tokenType,
            email: normalizedLoginPayload.email,
            userId: normalizedLoginPayload.userId,
            roles: normalizedLoginPayload.roles,
            plan: normalizedLoginPayload.plan,
          },
          remember,
        );
      } else if (mode === "login") {
        throw new Error("missing access token in login response");
      }

      showToast(
        mode === "login"
          ? Locale.AuthCredential.Success
          : Locale.AuthCredential.RegisterSuccess,
      );
      if (mode === "login") {
        navigate(Path.Chat);
      } else {
        navigate(Path.AuthRegisterSuccess);
      }
    } catch (error) {
      console.error("[Auth] sign-in failed", error);
      showToast(
        mode === "login"
          ? Locale.AuthCredential.Failed
          : Locale.AuthCredential.RegisterFailed,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeChange = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setIsSubmitting(false);
    setPassword("");
    setConfirmPassword("");
  };

  const handleGoogleOAuth = () => {
    const rememberFlag = remember && mode === "login" ? "1" : "0";
    window.location.href = `/api/auth/google/start?remember=${rememberFlag}`;
  };

  const submitLabel =
    mode === "login"
      ? isSubmitting
        ? Locale.AuthCredential.Submitting
        : Locale.AuthCredential.Submit
      : isSubmitting
      ? Locale.AuthCredential.RegisterSubmitting
      : Locale.AuthCredential.RegisterSubmit;

  const subtitle =
    mode === "login"
      ? Locale.AuthCredential.Subtitle
      : Locale.AuthCredential.RegisterSubtitle;

  const shouldRemember = mode === "login";
  const shouldShowForgot = mode === "login";

  return (
    <div className={styles["auth-credentials-page"]}>
      <header className={styles["auth-credentials-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text={Locale.Auth.Return}
          onClick={() => navigate(Path.Home)}
        />
      </header>
      <main className={styles["auth-credentials-body"]}>
        <section className={styles["auth-credentials-card"]}>
          <form
            className={styles["auth-credentials-form"]}
            onSubmit={handleSubmit}
          >
            <div className={styles["auth-credentials-title"]}>
              {Locale.AuthCredential.Title}
            </div>
            <div className={styles["auth-credentials-subtitle"]}>
              {subtitle}
            </div>
            <div className={styles["auth-credentials-tabs"]}>
              <button
                type="button"
                onClick={() => handleModeChange("login")}
                className={clsx(
                  styles["auth-credentials-tab"],
                  mode === "login" && styles["auth-credentials-tab-active"],
                )}
              >
                {Locale.AuthCredential.ModeLogin}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("register")}
                className={clsx(
                  styles["auth-credentials-tab"],
                  mode === "register" && styles["auth-credentials-tab-active"],
                )}
              >
                {Locale.AuthCredential.ModeRegister}
              </button>
            </div>

            <label className={styles["auth-credentials-label"]}>
              {Locale.AuthCredential.EmailLabel}
            </label>
            <input
              className={styles["auth-credentials-input"]}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={Locale.AuthCredential.EmailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />

            <label className={styles["auth-credentials-label"]}>
              {Locale.AuthCredential.PasswordLabel}
            </label>
            <PasswordInput
              aria={Locale.Settings.ShowPassword}
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={Locale.AuthCredential.PasswordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />

            {mode === "register" && (
              <>
                <label className={styles["auth-credentials-label"]}>
                  {Locale.AuthCredential.ConfirmPasswordLabel}
                </label>
                <PasswordInput
                  aria={Locale.Settings.ShowPassword}
                  name="confirm-password"
                  autoComplete="new-password"
                  placeholder={Locale.AuthCredential.ConfirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.currentTarget.value)
                  }
                />
              </>
            )}

            {(shouldRemember || shouldShowForgot) && (
              <div className={styles["auth-credentials-row"]}>
                {shouldRemember && (
                  <label className={styles["auth-credentials-remember"]}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) =>
                        setRemember(event.currentTarget.checked)
                      }
                    />
                    <span>{Locale.AuthCredential.Remember}</span>
                  </label>
                )}
                {shouldShowForgot && (
                  <button
                    type="button"
                    className={styles["auth-credentials-link"]}
                    onClick={() => showToast(Locale.AuthCredential.ForgotHint)}
                  >
                    {Locale.AuthCredential.Forgot}
                  </button>
                )}
              </div>
            )}

            <IconButton
              type="primary"
              text={submitLabel}
              className={styles["auth-credentials-submit"]}
              disabled={isSubmitting}
            />

            <div className={styles["auth-credentials-divider"]}>
              <span>{Locale.AuthCredential.Divider}</span>
            </div>

            <div className={styles["auth-credentials-oauth"]}>
              <IconButton
                text={Locale.AuthCredential.OAuthGoogle}
                onClick={handleGoogleOAuth}
              />
              <IconButton text={Locale.AuthCredential.OAuthApple} disabled />
              <IconButton
                text={Locale.AuthCredential.OAuthMicrosoft}
                disabled
              />
            </div>
            <div className={styles["auth-footer"]}>
              <a className={styles["auth-footer-link"]} href="/#/terms">
                {Locale.Auth.TermsOfUse}
              </a>
              <span className={styles["auth-footer-divider"]}>|</span>
              <a className={styles["auth-footer-link"]} href="/#/privacy">
                {Locale.Auth.PrivacyPolicy}
              </a>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
