import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./profile.module.scss";

import CloseIcon from "../icons/close.svg";

import { IconButton } from "./button";
import { List, ListItem, Popover, Select, showToast } from "./ui-lib";

import { ErrorBoundary } from "./error";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { Avatar, AvatarPicker } from "./emoji";
import { DEFAULT_PROFILE, useAppConfig, useProfileStore } from "../store";
import Locale from "../locales";
import { clearAuthSession, getAuthSession } from "../utils/auth-session";

const PAID_LEVELS = ["free", "pro", "premium"];
const SERVICE_LEVELS = ["free", "standard", "enterprise"];
const GENDER_PREFERENCE_OPTIONS = ["male", "female"] as const;
const AUTO_SYNC = false;
type ProfilePayload = {
  displayName: string;
  preferredLanguage: string;
  genderPreference: string;
  paidLevel: string;
  serviceLevel: string;
};

function normalizeLevel(value: string, fallback: string, list: string[]) {
  const trimmed = value?.trim();
  if (!trimmed || !list.includes(trimmed)) return fallback;
  return trimmed;
}

function normalizeGenderPreference(value: string) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return "";
  if (GENDER_PREFERENCE_OPTIONS.includes(trimmed as "male" | "female")) {
    return trimmed;
  }
  return "";
}

function resolveGenderPreference(value: string | undefined) {
  return normalizeGenderPreference(value ?? "") || "male";
}

function pickNextLevel(value: string, list: string[]) {
  const index = list.indexOf(value);
  if (index === -1) return list[0];
  return list[Math.min(index + 1, list.length - 1)];
}

function isAtMaxLevel(value: string, list: string[]) {
  const index = list.indexOf(value);
  return index >= list.length - 1 && index !== -1;
}

export function Profile() {
  const navigate = useNavigate();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const config = useAppConfig();
  const displayName = useProfileStore((state) => state.displayName);
  const preferredLanguage = useProfileStore((state) => state.preferredLanguage);
  const genderPreference = useProfileStore((state) => state.genderPreference);
  const paidLevel = useProfileStore((state) => state.paidLevel);
  const serviceLevel = useProfileStore((state) => state.serviceLevel);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const [authSession, setAuthSession] = useState(() => getAuthSession());
  const isLoggedIn = Boolean(authSession?.accessToken);
  const email = authSession?.email?.trim() || Locale.Profile.EmailNotLoggedIn;
  const [isSyncing, setIsSyncing] = useState(false);
  const emailSubtitle = isLoggedIn ? email : Locale.Profile.EmailNotLoggedIn;
  const resolvedGenderPreference = resolveGenderPreference(genderPreference);
  const normalizedPaidLevel = normalizeLevel(paidLevel, "free", PAID_LEVELS);
  const normalizedServiceLevel = normalizeLevel(
    serviceLevel,
    "free",
    SERVICE_LEVELS,
  );

  const genderPreferenceOptions = useMemo(
    () => [
      {
        value: "male",
        label: Locale.Profile.GenderPreference.Options.Male,
      },
      {
        value: "female",
        label: Locale.Profile.GenderPreference.Options.Female,
      },
    ],
    [],
  );

  useEffect(() => {
    if (!isLoggedIn || !authSession?.accessToken) return;
    let canceled = false;
    const loadRemoteProfile = async () => {
      try {
        setIsSyncing(true);
        const res = await fetch("/api/user/profile", {
          headers: {
            Authorization: `${
              authSession?.tokenType ?? "Bearer"
            } ${authSession?.accessToken}`,
          },
        });
        if (!res.ok) {
          throw new Error("profile sync failed");
        }
        const data = (await res.json()) as Partial<ProfilePayload>;
        if (canceled) return;
        const profileSnapshot = useProfileStore.getState();
        const normalized = {
          displayName:
            data.displayName?.trim() ||
            profileSnapshot.displayName ||
            DEFAULT_PROFILE.displayName,
          preferredLanguage:
            data.preferredLanguage ?? profileSnapshot.preferredLanguage,
          genderPreference: resolveGenderPreference(
            data.genderPreference ?? profileSnapshot.genderPreference,
          ),
          paidLevel: normalizeLevel(
            data.paidLevel ?? profileSnapshot.paidLevel,
            "free",
            PAID_LEVELS,
          ),
          serviceLevel: normalizeLevel(
            data.serviceLevel ?? profileSnapshot.serviceLevel,
            "free",
            SERVICE_LEVELS,
          ),
        };
        updateProfile((profile) => {
          profile.displayName = normalized.displayName;
          profile.preferredLanguage = normalized.preferredLanguage;
          profile.genderPreference = normalized.genderPreference;
          profile.paidLevel = normalized.paidLevel;
          profile.serviceLevel = normalized.serviceLevel;
          profile.lastSyncedAt = Date.now();
        });
      } catch (error) {
        if (!canceled) {
          showToast(Locale.Profile.Toasts.LoadFailed);
        }
      } finally {
        if (!canceled) {
          setIsSyncing(false);
        }
      }
    };
    loadRemoteProfile();
    return () => {
      canceled = true;
    };
  }, [
    authSession?.accessToken,
    authSession?.tokenType,
    isLoggedIn,
    updateProfile,
  ]);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthSession(null);
    showToast(Locale.Profile.Toasts.Logout);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      displayName: displayName.trim() || DEFAULT_PROFILE.displayName,
      preferredLanguage: preferredLanguage.trim(),
      genderPreference: resolveGenderPreference(genderPreference),
      paidLevel: normalizeLevel(paidLevel, "free", PAID_LEVELS),
      serviceLevel: normalizeLevel(serviceLevel, "free", SERVICE_LEVELS),
    };

    if (!isLoggedIn || !authSession?.accessToken) {
      showToast(Locale.Profile.Toasts.SavedLocal);
      return;
    }

    try {
      setIsSyncing(true);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${
            authSession?.tokenType ?? "Bearer"
          } ${authSession?.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("profile save failed");
      }
      updateProfile((profile) => {
        profile.lastSyncedAt = Date.now();
      });
      showToast(Locale.Profile.Toasts.Synced);
    } catch (error) {
      showToast(Locale.Profile.Toasts.SyncFailed);
    } finally {
      setIsSyncing(false);
    }
  }, [
    authSession?.accessToken,
    authSession?.tokenType,
    displayName,
    genderPreference,
    isLoggedIn,
    paidLevel,
    preferredLanguage,
    serviceLevel,
    updateProfile,
  ]);

  useEffect(() => {
    if (!AUTO_SYNC || !isLoggedIn || !authSession?.accessToken) return;
    if (isSyncing) return;
    const controller = new AbortController();
    const payload = {
      displayName: displayName.trim() || DEFAULT_PROFILE.displayName,
      preferredLanguage: preferredLanguage.trim(),
      genderPreference: resolveGenderPreference(genderPreference),
      paidLevel: normalizeLevel(paidLevel, "free", PAID_LEVELS),
      serviceLevel: normalizeLevel(serviceLevel, "free", SERVICE_LEVELS),
    };
    const timer = window.setTimeout(async () => {
      try {
        setIsSyncing(true);
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `${
              authSession?.tokenType ?? "Bearer"
            } ${authSession?.accessToken}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("profile save failed");
        }
        updateProfile((profile) => {
          profile.lastSyncedAt = Date.now();
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          showToast(Locale.Profile.Toasts.SyncFailed);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSyncing(false);
        }
      }
    }, 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    authSession?.accessToken,
    authSession?.tokenType,
    displayName,
    genderPreference,
    isLoggedIn,
    isSyncing,
    paidLevel,
    preferredLanguage,
    serviceLevel,
    updateProfile,
  ]);

  const nextPaidLevel = pickNextLevel(normalizedPaidLevel, PAID_LEVELS);
  const nextServiceLevel = pickNextLevel(
    normalizedServiceLevel,
    SERVICE_LEVELS,
  );
  const paidAtMax = isAtMaxLevel(normalizedPaidLevel, PAID_LEVELS);
  const serviceAtMax = isAtMaxLevel(normalizedServiceLevel, SERVICE_LEVELS);

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">{Locale.Profile.Title}</div>
          <div className="window-header-sub-title">
            {Locale.Profile.SubTitle}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              aria={Locale.UI.Close}
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Home)}
              bordered
            />
          </div>
        </div>
      </div>
      <div className={styles.profile}>
        <div className={styles["profile-summary"]}>
          <div className={styles["profile-avatar"]}>
            <Avatar avatar={config.avatar} />
          </div>
          <div>
            <div className={styles["profile-name"]}>
              {displayName || DEFAULT_PROFILE.displayName}
            </div>
            <div className={styles["profile-subtitle"]}>
              {isLoggedIn
                ? Locale.Profile.SubtitleLoggedIn
                : Locale.Profile.SubtitleLoggedOut}
            </div>
          </div>
        </div>
        <List>
          <ListItem title={Locale.Profile.Avatar}>
            <Popover
              onClose={() => setShowAvatarPicker(false)}
              content={
                <AvatarPicker
                  onEmojiClick={(avatar: string) => {
                    config.update((config) => (config.avatar = avatar));
                    setShowAvatarPicker(false);
                  }}
                />
              }
              open={showAvatarPicker}
            >
              <div
                aria-label={Locale.Profile.AvatarLabel}
                tabIndex={0}
                className={styles.avatar}
                onClick={() => {
                  setShowAvatarPicker(!showAvatarPicker);
                }}
              >
                <Avatar avatar={config.avatar} />
              </div>
            </Popover>
          </ListItem>
          <ListItem title={Locale.Profile.Email} subTitle={emailSubtitle}>
            {isLoggedIn ? (
              <IconButton
                aria={Locale.Profile.Logout}
                text={Locale.Profile.Logout}
                type="danger"
                onClick={handleLogout}
              />
            ) : (
              <div className={styles["profile-actions"]}>
                <IconButton
                  aria={Locale.Profile.Login}
                  text={Locale.Profile.Login}
                  type="primary"
                  onClick={() => navigate(Path.Auth)}
                />
              </div>
            )}
          </ListItem>
          <ListItem
            title={Locale.Profile.PaidLevel}
            subTitle={normalizedPaidLevel}
          >
            <div className={styles["profile-actions"]}>
              <IconButton
                aria={Locale.Profile.PaidLevel}
                text={
                  paidAtMax
                    ? Locale.Profile.MaxLevel
                    : Locale.Profile.UpgradeTo(nextPaidLevel)
                }
                type="primary"
                disabled={paidAtMax}
                onClick={() =>
                  updateProfile((profile) => {
                    profile.paidLevel = nextPaidLevel;
                  })
                }
              />
            </div>
          </ListItem>
          <ListItem
            title={Locale.Profile.ServiceLevel}
            subTitle={normalizedServiceLevel}
          >
            <div className={styles["profile-actions"]}>
              <IconButton
                aria={Locale.Profile.ServiceLevel}
                text={
                  serviceAtMax
                    ? Locale.Profile.MaxLevel
                    : Locale.Profile.UpgradeTo(nextServiceLevel)
                }
                type="primary"
                disabled={serviceAtMax}
                onClick={() =>
                  updateProfile((profile) => {
                    profile.serviceLevel = nextServiceLevel;
                  })
                }
              />
            </div>
          </ListItem>
          <ListItem
            title={Locale.Profile.GenderPreference.Title}
            subTitle={Locale.Profile.GenderPreference.SubTitle}
          >
            <Select
              aria-label={Locale.Profile.GenderPreference.Title}
              value={resolvedGenderPreference}
              onChange={(event) =>
                updateProfile((profile) => {
                  profile.genderPreference = resolveGenderPreference(
                    event.currentTarget.value,
                  );
                })
              }
            >
              {genderPreferenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </ListItem>
          <ListItem
            title={Locale.Profile.Save.Title}
            subTitle={
              isLoggedIn
                ? isSyncing
                  ? Locale.Profile.Save.Syncing
                  : Locale.Profile.Save.SyncHint
                : Locale.Profile.Save.LocalHint
            }
          >
            <div className={styles["profile-actions"]}>
              <IconButton
                aria={Locale.Profile.Save.Button}
                text={
                  isSyncing
                    ? Locale.Profile.Save.SyncingButton
                    : Locale.Profile.Save.Button
                }
                type="primary"
                disabled={isSyncing}
                onClick={handleSave}
              />
            </div>
          </ListItem>
        </List>
      </div>
    </ErrorBoundary>
  );
}
