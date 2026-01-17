import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

export type UserProfile = {
  displayName: string;
  preferredLanguage: string;
  paidLevel: string;
  serviceLevel: string;
  lastSyncedAt?: number;
};

const DEFAULT_NAME_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
const DEFAULT_NAME_LENGTH = 8;

const generateDefaultDisplayName = () => {
  let suffix = "";
  for (let i = 0; i < DEFAULT_NAME_LENGTH; i += 1) {
    suffix +=
      DEFAULT_NAME_CHARS[Math.floor(Math.random() * DEFAULT_NAME_CHARS.length)];
  }
  return `user_${suffix}`;
};

export const createDefaultProfile = (): UserProfile => ({
  displayName: generateDefaultDisplayName(),
  preferredLanguage: "cn",
  paidLevel: "free",
  serviceLevel: "free",
  lastSyncedAt: undefined,
});

export const DEFAULT_PROFILE: UserProfile = createDefaultProfile();

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
      set(() => ({ ...createDefaultProfile() }));
    },
  }),
  {
    name: StoreKey.Profile,
    version: 1,
  },
);
