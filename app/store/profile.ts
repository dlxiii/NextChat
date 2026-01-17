import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

export type UserProfile = {
  displayName: string;
  gender: string;
  age: string;
  preferredLanguage: string;
  region: string;
  paidLevel: string;
  serviceLevel: string;
  lastSyncedAt?: number;
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "Hexagram 用户",
  gender: "",
  age: "",
  preferredLanguage: "中文",
  region: "中国",
  paidLevel: "free",
  serviceLevel: "free",
  lastSyncedAt: undefined,
};

export const useProfileStore = createPersistStore(
  { ...DEFAULT_PROFILE },
  (set) => ({
    updateProfile(updater: (profile: UserProfile) => void) {
      set((state) => {
        const nextState = { ...state };
        updater(nextState);
        return nextState;
      });
    },
    resetProfile() {
      set(() => ({ ...DEFAULT_PROFILE }));
    },
  }),
  {
    name: StoreKey.Profile,
    version: 1,
  },
);
