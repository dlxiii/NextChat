import styles from "./auth-credentials.module.scss";
import { IconButton } from "./button";
import { showToast } from "./ui-lib";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiPath, Path } from "../constant";
import Locale from "../locales";
import LeftIcon from "../icons/left.svg";
import BotIcon from "../icons/bot.svg";
import { PasswordInput } from "./ui-lib";
import clsx from "clsx";

export function AuthCredentialsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      showToast(Locale.AuthCredential.Validation);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(ApiPath.AuthLogin, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          remember,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      showToast(Locale.AuthCredential.Success);
      navigate(Path.Chat);
    } catch (error) {
      console.error("[Auth] sign-in failed", error);
      showToast(Locale.AuthCredential.Failed);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className={styles["auth-credentials-hero"]}>
            <div className={clsx("no-dark", styles["auth-credentials-logo"])}>
              <BotIcon />
            </div>
            <div className={styles["auth-credentials-hero-title"]}>
              {Locale.AuthCredential.HeroTitle}
            </div>
            <div className={styles["auth-credentials-hero-subtitle"]}>
              {Locale.AuthCredential.HeroSubtitle}
            </div>
            <div className={styles["auth-credentials-hero-note"]}>
              {Locale.AuthCredential.HeroNote}
            </div>
            <div className={styles["auth-credentials-api-hint"]}>
              {Locale.AuthCredential.ApiHint}
              <code>{ApiPath.AuthLogin}</code>
            </div>
          </div>
          <form
            className={styles["auth-credentials-form"]}
            onSubmit={handleSubmit}
          >
            <div className={styles["auth-credentials-title"]}>
              {Locale.AuthCredential.Title}
            </div>
            <div className={styles["auth-credentials-subtitle"]}>
              {Locale.AuthCredential.Subtitle}
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
              autoComplete="current-password"
              placeholder={Locale.AuthCredential.PasswordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />

            <div className={styles["auth-credentials-row"]}>
              <label className={styles["auth-credentials-remember"]}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.currentTarget.checked)}
                />
                <span>{Locale.AuthCredential.Remember}</span>
              </label>
              <button
                type="button"
                className={styles["auth-credentials-link"]}
                onClick={() => showToast(Locale.AuthCredential.ForgotHint)}
              >
                {Locale.AuthCredential.Forgot}
              </button>
            </div>

            <IconButton
              type="primary"
              text={
                isSubmitting
                  ? Locale.AuthCredential.Submitting
                  : Locale.AuthCredential.Submit
              }
              className={styles["auth-credentials-submit"]}
              disabled={isSubmitting}
            />

            <div className={styles["auth-credentials-divider"]}>
              <span>{Locale.AuthCredential.Divider}</span>
            </div>

            <div className={styles["auth-credentials-oauth"]}>
              <IconButton
                text={Locale.AuthCredential.OAuthGoogle}
                disabled
              />
              <IconButton
                text={Locale.AuthCredential.OAuthGithub}
                disabled
              />
              <IconButton
                text={Locale.AuthCredential.OAuthMicrosoft}
                disabled
              />
            </div>

            <button
              type="button"
              className={styles["auth-credentials-backup"]}
              onClick={() => navigate(Path.AuthBackup)}
            >
              {Locale.AuthCredential.BackupLink}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
