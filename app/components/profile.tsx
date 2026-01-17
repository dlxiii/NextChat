import { useMemo, useState } from "react";

import styles from "./profile.module.scss";

import CloseIcon from "../icons/close.svg";

import { IconButton } from "./button";
import { List, ListItem, Popover } from "./ui-lib";

import { ErrorBoundary } from "./error";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { Avatar, AvatarPicker } from "./emoji";
import { useAppConfig } from "../store";
import { getAuthSession } from "../utils/auth-session";

const PROFILE_ITEMS = [
  { label: "性别", value: "未设置" },
  { label: "年龄", value: "未设置" },
  { label: "偏好语言", value: "中文" },
  { label: "地区", value: "中国" },
];

export function Profile() {
  const navigate = useNavigate();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const config = useAppConfig();
  const authSession = getAuthSession();
  const isLoggedIn = Boolean(authSession?.accessToken);
  const email = authSession?.email?.trim() || "未登录";
  const paidLevel = isLoggedIn ? authSession?.plan ?? "未设置" : "未登录";
  const serviceLevel = isLoggedIn
    ? authSession?.roles?.length
      ? authSession.roles.join(", ")
      : "未设置"
    : "未登录";
  const emailSubtitle = useMemo(() => {
    if (isLoggedIn) {
      return email;
    }
    return (
      <button
        type="button"
        className={styles["login-link"]}
        onClick={() => navigate(Path.Auth)}
      >
        登录
      </button>
    );
  }, [email, isLoggedIn, navigate]);

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
            <div className={styles["profile-name"]}>Hexagram 用户</div>
            <div className={styles["profile-subtitle"]}>
              欢迎回来，完善资料以解锁更多服务
            </div>
          </div>
        </div>
        <List>
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
          <ListItem
            title="注册邮箱"
            subTitle={emailSubtitle}
            onClick={!isLoggedIn ? () => navigate(Path.Auth) : undefined}
          />
          <ListItem title="付费等级" subTitle={paidLevel} />
          <ListItem title="服务等级" subTitle={serviceLevel} />
          {PROFILE_ITEMS.map((item) => (
            <ListItem
              key={item.label}
              title={item.label}
              subTitle={item.value}
            />
          ))}
        </List>
      </div>
    </ErrorBoundary>
  );
}
