import { create } from 'zustand';

import { updateProfile, type Profile } from '@/lib/api/profile';
import type { LanguageId, ReminderOffset } from '@/lib/prefs';

// App-preferences store — the synchronous, reactive MIRROR of the signed-in
// user's profile row (Auth-2): app language, the master push/reminder switches,
// and the default reminder lead-times. The Supabase profile is the durable
// source of truth; this store is hydrated from it at sign-in (useProfileBootstrap)
// and every setter writes through to the profile (fire-and-forget, like the old
// SecureStore persist — a failed write just means the change isn't durable).
// The mirror keeps the selectors below synchronous, so the i18n layer and the
// auth screens keep working while signed out (defaults) and offline.
//
// MVP scope: the reminder lead-times + switches only persist the user's intent;
// NO push registration or scheduling happens here — that is a later phase.

// Re-exported so existing call sites (screens, i18n, api) keep their imports;
// the catalogs live in prefs.ts so the API layer can use them without a cycle.
export {
  LANGUAGES,
  LANGUAGE_IDS,
  REMINDER_OPTIONS,
  languageName,
  type Language,
  type LanguageId,
  type ReminderOffset,
  type ReminderOption,
} from '@/lib/prefs';

export const SETTINGS_DEFAULTS = {
  language: 'en' as LanguageId,
  // Push + reminders default ON (frame shows both toggles on); the day-before
  // lead-time is pre-selected to match the Event reminders frame. Mirrors the
  // profiles column defaults.
  pushEnabled: true,
  remindersEnabled: true,
  reminderOffsets: ['1_day'] as ReminderOffset[],
};

function persist(patch: Parameters<typeof updateProfile>[0]): void {
  // Fire-and-forget; a failed write just means this change isn't durable.
  updateProfile(patch).catch((error: unknown) => {
    if (__DEV__) console.warn('[settings] profile write failed', error);
  });
}

interface SettingsState {
  language: LanguageId;
  pushEnabled: boolean;
  remindersEnabled: boolean;
  reminderOffsets: ReminderOffset[];
  /** Set the app language, then persist to the profile. No-op when unchanged. */
  setLanguage: (language: LanguageId) => void;
  /** Master push switch (Profile hub). Persisted preference only — see above. */
  setPushEnabled: (enabled: boolean) => void;
  /** Master event-reminders switch (Event reminders screen). */
  setRemindersEnabled: (enabled: boolean) => void;
  /** Add or remove a default lead-time, then persist to the profile. */
  toggleReminderOffset: (offset: ReminderOffset) => void;
  /** Adopt the fetched profile values (no write back). */
  applyProfile: (profile: Profile) => void;
  /** Back to defaults — called on sign-out so the next user starts clean. */
  reset: () => void;
}

export const useSettings = create<SettingsState>((set) => ({
  ...SETTINGS_DEFAULTS,
  reminderOffsets: [...SETTINGS_DEFAULTS.reminderOffsets],
  setLanguage: (language) =>
    set((state) => {
      if (state.language === language) return state;
      persist({ language });
      return { language };
    }),
  setPushEnabled: (pushEnabled) =>
    set((state) => {
      if (state.pushEnabled === pushEnabled) return state;
      persist({ pushEnabled });
      return { pushEnabled };
    }),
  setRemindersEnabled: (remindersEnabled) =>
    set((state) => {
      if (state.remindersEnabled === remindersEnabled) return state;
      persist({ remindersEnabled });
      return { remindersEnabled };
    }),
  toggleReminderOffset: (offset) =>
    set((state) => {
      const reminderOffsets = state.reminderOffsets.includes(offset)
        ? state.reminderOffsets.filter((o) => o !== offset)
        : [...state.reminderOffsets, offset];
      persist({ reminderOffsets });
      return { reminderOffsets };
    }),
  applyProfile: (profile) =>
    set({
      language: profile.language,
      pushEnabled: profile.pushEnabled,
      remindersEnabled: profile.remindersEnabled,
      reminderOffsets: profile.reminderOffsets,
    }),
  reset: () =>
    set({
      ...SETTINGS_DEFAULTS,
      reminderOffsets: [...SETTINGS_DEFAULTS.reminderOffsets],
    }),
}));

/** Reactive: the active app language. */
export const useLanguage = (): LanguageId => useSettings((s) => s.language);

/** Reactive: the master push switch. */
export const usePushEnabled = (): boolean => useSettings((s) => s.pushEnabled);

/** Reactive: the master event-reminders switch. */
export const useRemindersEnabled = (): boolean => useSettings((s) => s.remindersEnabled);

/** Reactive: the chosen default reminder lead-times (new reference on every change). */
export const useReminderOffsets = (): ReminderOffset[] => useSettings((s) => s.reminderOffsets);
