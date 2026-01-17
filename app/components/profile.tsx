import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./profile.module.scss";

import CloseIcon from "../icons/close.svg";

import { IconButton } from "./button";
import { InputRange } from "./input-range";
import { List, ListItem, Popover, Select, showToast } from "./ui-lib";

import { ErrorBoundary } from "./error";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { Avatar, AvatarPicker } from "./emoji";
import { useAppConfig, useProfileStore } from "../store";
import { ALL_LANG_OPTIONS, AllLangs, type Lang } from "../locales";
import { clearAuthSession, getAuthSession } from "../utils/auth-session";
import countries from "i18n-iso-countries";
import zhLocale from "i18n-iso-countries/langs/zh.json";

const PAID_LEVELS = ["free", "pro", "premium"];
const SERVICE_LEVELS = ["free", "standard", "enterprise"];
const NAME_RULE = /^[\u4e00-\u9fa5A-Za-z0-9_ ]{2,16}$/;
const REGION_LOCALE = "zh";

countries.registerLocale(zhLocale);

type ProfileFormState = {
  displayName: string;
  gender: string;
  age: string;
  preferredLanguage: string;
  region: string;
  paidLevel: string;
  serviceLevel: string;
};

function normalizeLevel(value: string, fallback: string, list: string[]) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (!list.includes(trimmed)) return trimmed;
  return trimmed;
}

function normalizeLanguage(value: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (AllLangs.includes(trimmed as Lang)) {
    return trimmed;
  }
  const match = Object.entries(ALL_LANG_OPTIONS).find(
    ([, label]) => label === trimmed,
  );
  return match ? match[0] : trimmed;
}

function normalizeRegion(value: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (countries.getName(upper, REGION_LOCALE)) {
    return upper;
  }
  const alpha2 = countries.getAlpha2Code(trimmed, REGION_LOCALE);
  return alpha2 ?? trimmed;
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
  const profileState = useProfileStore((state) => ({
    displayName: state.displayName,
    gender: state.gender,
    age: state.age,
    preferredLanguage: state.preferredLanguage,
    region: state.region,
    paidLevel: state.paidLevel,
    serviceLevel: state.serviceLevel,
  }));
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const [authSession, setAuthSession] = useState(() => getAuthSession());
  const isLoggedIn = Boolean(authSession?.accessToken);
  const email = authSession?.email?.trim() || "未登录";
  const [isSyncing, setIsSyncing] = useState(false);
  const [formState, setFormState] = useState<ProfileFormState>({
    displayName: profileState.displayName,
    gender: profileState.gender,
    age: profileState.age,
    preferredLanguage: normalizeLanguage(profileState.preferredLanguage),
    region: normalizeRegion(profileState.region),
    paidLevel: normalizeLevel(profileState.paidLevel, "free", PAID_LEVELS),
    serviceLevel: normalizeLevel(
      profileState.serviceLevel,
      "free",
      SERVICE_LEVELS,
    ),
  });
  const emailSubtitle = isLoggedIn ? email : "未登录";

  const languageOptions = useMemo(
    () =>
      Object.entries(ALL_LANG_OPTIONS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const regionOptions = useMemo(() => {
    const names = countries.getNames(REGION_LOCALE, { select: "official" });
    return Object.entries(names)
      .map(([code, name]) => ({ value: code, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
  }, []);

  const syncFormFromStore = useCallback(() => {
    setFormState({
      displayName: profileState.displayName,
      gender: profileState.gender,
      age: profileState.age,
      preferredLanguage: normalizeLanguage(profileState.preferredLanguage),
      region: normalizeRegion(profileState.region),
      paidLevel: normalizeLevel(profileState.paidLevel, "free", PAID_LEVELS),
      serviceLevel: normalizeLevel(
        profileState.serviceLevel,
        "free",
        SERVICE_LEVELS,
      ),
    });
  }, [profileState]);

  useEffect(() => {
    syncFormFromStore();
  }, [syncFormFromStore]);

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
        const data = (await res.json()) as Partial<ProfileFormState>;
        if (canceled) return;
        const profileSnapshot = useProfileStore.getState();
        const normalized = {
          displayName:
            data.displayName?.trim() ||
            profileSnapshot.displayName ||
            "Hexagram 用户",
          gender: data.gender ?? profileSnapshot.gender,
          age: data.age?.toString() ?? profileSnapshot.age,
          preferredLanguage: normalizeLanguage(
            data.preferredLanguage ?? profileSnapshot.preferredLanguage,
          ),
          region: normalizeRegion(data.region ?? profileSnapshot.region),
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
          profile.gender = normalized.gender;
          profile.age = normalized.age;
          profile.preferredLanguage = normalized.preferredLanguage;
          profile.region = normalized.region;
          profile.paidLevel = normalized.paidLevel;
          profile.serviceLevel = normalized.serviceLevel;
          profile.lastSyncedAt = Date.now();
        });
        setFormState(normalized);
      } catch (error) {
        if (!canceled) {
          showToast("读取后端资料失败，已使用本地缓存");
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

  const displayNameError =
    formState.displayName.trim().length > 0 &&
    !NAME_RULE.test(formState.displayName.trim());
  const ageValue = formState.age.trim();
  const ageNumber = Number(ageValue);
  const ageNumberValid = ageValue.length > 0 && !Number.isNaN(ageNumber);
  const ageInvalid =
    ageValue.length > 0 &&
    (Number.isNaN(ageNumber) || ageNumber < 1 || ageNumber > 120);
  const ageSliderValue = ageNumberValid ? ageNumber : 18;
  const ageLabel = ageNumberValid ? `${ageNumber} 岁` : "未设置";

  const updateField = useCallback(
    (key: keyof ProfileFormState) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormState((prev) => ({
          ...prev,
          [key]: event.target?.value ?? "",
        }));
      },
    [],
  );

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthSession(null);
    showToast("已注销登录");
  }, []);

  const handleSave = useCallback(async () => {
    if (displayNameError) {
      showToast("用户名需为 2-16 位中文/字母/数字/下划线/空格");
      return;
    }
    if (ageInvalid) {
      showToast("年龄需为 1-120 的数字");
      return;
    }

    const payload = {
      displayName: formState.displayName.trim() || "Hexagram 用户",
      gender: formState.gender,
      age: formState.age.trim(),
      preferredLanguage: formState.preferredLanguage.trim(),
      region: formState.region.trim(),
      paidLevel: formState.paidLevel,
      serviceLevel: formState.serviceLevel,
    };

    updateProfile((profile) => {
      profile.displayName = payload.displayName;
      profile.gender = payload.gender;
      profile.age = payload.age;
      profile.preferredLanguage = payload.preferredLanguage;
      profile.region = payload.region;
      profile.paidLevel = payload.paidLevel;
      profile.serviceLevel = payload.serviceLevel;
    });

    if (!isLoggedIn || !authSession?.accessToken) {
      showToast("已保存到本地缓存，登录后才会同步，清理缓存将丢失");
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
      showToast("设置已同步到后端");
    } catch (error) {
      showToast("同步失败，已保存在本地缓存");
    } finally {
      setIsSyncing(false);
    }
  }, [
    ageInvalid,
    authSession?.accessToken,
    authSession?.tokenType,
    displayNameError,
    formState,
    isLoggedIn,
    updateProfile,
  ]);

  const nextPaidLevel = pickNextLevel(formState.paidLevel, PAID_LEVELS);
  const nextServiceLevel = pickNextLevel(
    formState.serviceLevel,
    SERVICE_LEVELS,
  );
  const paidAtMax = isAtMaxLevel(formState.paidLevel, PAID_LEVELS);
  const serviceAtMax = isAtMaxLevel(formState.serviceLevel, SERVICE_LEVELS);

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">用户资料</div>
          <div className="window-header-sub-title">
            管理你的个人信息与偏好设置
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              aria="关闭"
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
              {formState.displayName || "Hexagram 用户"}
            </div>
            <div className={styles["profile-subtitle"]}>
              {isLoggedIn
                ? "欢迎回来，完善资料以解锁更多服务"
                : "登录后可同步至云端"}
            </div>
          </div>
        </div>
        <List>
          <ListItem title="用户名" subTitle="2-16 位中文/字母/数字/下划线/空格">
            <div className={styles["profile-control"]}>
              <input
                type="text"
                value={formState.displayName}
                onChange={updateField("displayName")}
                placeholder="请输入用户名"
                className={styles["profile-input"]}
              />
              {displayNameError ? (
                <div className={styles["profile-hint"]} data-error="true">
                  用户名需为 2-16 位中文/字母/数字/下划线/空格
                </div>
              ) : null}
            </div>
          </ListItem>
          <ListItem title="头像">
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
                aria-label="用户头像"
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
          <ListItem title="注册邮箱" subTitle={emailSubtitle}>
            {isLoggedIn ? (
              <IconButton
                aria="注销账号"
                text="注销"
                type="danger"
                onClick={handleLogout}
              />
            ) : (
              <div className={styles["profile-actions"]}>
                <IconButton
                  aria="登录"
                  text="登录"
                  type="primary"
                  onClick={() => navigate(Path.Auth)}
                />
              </div>
            )}
          </ListItem>
          <ListItem title="付费等级" subTitle={formState.paidLevel}>
            <div className={styles["profile-actions"]}>
              <IconButton
                aria="升级付费等级"
                text={paidAtMax ? "已是最高等级" : `升级到 ${nextPaidLevel}`}
                type="primary"
                disabled={paidAtMax}
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    paidLevel: nextPaidLevel,
                  }))
                }
              />
            </div>
          </ListItem>
          <ListItem title="服务等级" subTitle={formState.serviceLevel}>
            <div className={styles["profile-actions"]}>
              <IconButton
                aria="升级服务等级"
                text={
                  serviceAtMax ? "已是最高等级" : `升级到 ${nextServiceLevel}`
                }
                type="primary"
                disabled={serviceAtMax}
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    serviceLevel: nextServiceLevel,
                  }))
                }
              />
            </div>
          </ListItem>
          <ListItem title="性别" subTitle={isLoggedIn ? "" : "未登录也可编辑"}>
            <div className={styles["profile-control"]}>
              <Select
                value={formState.gender}
                onChange={updateField("gender")}
                className={styles["profile-select"]}
              >
                <option value="">未设置</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="nonbinary">非二元</option>
                <option value="private">不透露</option>
              </Select>
            </div>
          </ListItem>
          <ListItem title="年龄" subTitle={ageInvalid ? "请输入 1-120" : ""}>
            <div className={styles["profile-control"]}>
              <InputRange
                aria="年龄"
                min="1"
                max="120"
                step="1"
                value={ageSliderValue}
                title={ageLabel}
                className={styles["profile-range"]}
                onChange={updateField("age")}
              />
            </div>
          </ListItem>
          <ListItem title="偏好语言">
            <div className={styles["profile-control"]}>
              <Select
                value={formState.preferredLanguage}
                onChange={updateField("preferredLanguage")}
                className={styles["profile-select"]}
              >
                <option value="">未设置</option>
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </ListItem>
          <ListItem title="地区">
            <div className={styles["profile-control"]}>
              <Select
                value={formState.region}
                onChange={updateField("region")}
                className={styles["profile-select"]}
              >
                <option value="">未设置</option>
                {regionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </ListItem>
          <ListItem
            title="保存设置"
            subTitle={
              isLoggedIn
                ? isSyncing
                  ? "正在同步至后端"
                  : "同步到后端并更新本地缓存"
                : "未登录时仅保存到本地缓存"
            }
          >
            <div className={styles["profile-actions"]}>
              <IconButton
                aria="保存设置"
                text={isSyncing ? "同步中..." : "保存设置"}
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
