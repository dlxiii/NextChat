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

      if (mode === "login" && responseJson?.access_token) {
        persistAuthSession(
          {
            accessToken: responseJson.access_token as string,
            tokenType: responseJson.token_type as string | undefined,
            email: responseJson.email as string | undefined,
            userId: responseJson.userId as string | undefined,
            roles: responseJson.roles as string[] | undefined,
            plan: responseJson.plan as string | undefined,
          },
          remember,
        );
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
              <IconButton text={Locale.AuthCredential.OAuthGoogle} disabled />
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
