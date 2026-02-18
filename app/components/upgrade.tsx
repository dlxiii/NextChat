import { useNavigate } from "react-router-dom";

import { Path } from "../constant";
import Locale from "../locales";
import CloseIcon from "../icons/close.svg";
import { IconButton } from "./button";
import { ErrorBoundary } from "./error";

/**
 * 付费升级占位页。
 *
 * 实现流程：
 * 1. 当前版本仅负责承接 Profile 页的“升级”跳转；
 * 2. 明确向用户提示升级流程尚未开发完成，避免误以为操作失败；
 * 3. 提供返回资料页入口，保证导航闭环。
 */
export function UpgradePage() {
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">
            {Locale.Profile.UpgradePage.Title}
          </div>
          <div className="window-header-sub-title">
            {Locale.Profile.UpgradePage.SubTitle}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button"></div>
          <div className="window-action-button"></div>
          <div className="window-action-button">
            <IconButton
              aria={Locale.UI.Close}
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Profile)}
              bordered
            />
          </div>
        </div>
      </div>
      <div style={{ padding: 16, lineHeight: 1.8 }}>
        <p>{Locale.Profile.UpgradePage.Description}</p>
        <IconButton
          aria={Locale.Profile.UpgradePage.BackToProfile}
          text={Locale.Profile.UpgradePage.BackToProfile}
          type="primary"
          onClick={() => navigate(Path.Profile)}
        />
      </div>
    </ErrorBoundary>
  );
}
