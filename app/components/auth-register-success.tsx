import styles from "./auth-credentials.module.scss";
import { IconButton } from "./button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";
import LeftIcon from "../icons/left.svg";

const REDIRECT_SECONDS = 5;

export function AuthRegisterSuccessPage() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      navigate(Path.Auth);
    }
  }, [secondsLeft, navigate]);

  return (
    <div className={styles["auth-credentials-page"]}>
      <header className={styles["auth-credentials-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text={Locale.Auth.Return}
          onClick={() => navigate(Path.Auth)}
        />
      </header>
      <main className={styles["auth-credentials-body"]}>
        <section className={styles["auth-credentials-card"]}>
          <div className={styles["auth-credentials-title"]}>
            {Locale.AuthCredential.RegisterSuccessTitle}
          </div>
          <div className={styles["auth-credentials-subtitle"]}>
            {Locale.AuthCredential.RegisterSuccessSubtitle}
          </div>
          <div className={styles["auth-redirect-hint"]}>
            {Locale.AuthCredential.RegisterSuccessHint}
          </div>
          <div className={styles["auth-redirect-countdown"]}>
            {Locale.AuthCredential.RegisterSuccessCountdown(secondsLeft)}
          </div>
          <div className={styles["auth-redirect-actions"]}>
            <IconButton
              type="primary"
              text={Locale.AuthCredential.RegisterSuccessAction}
              onClick={() => navigate(Path.Auth)}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
