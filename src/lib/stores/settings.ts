import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// App-preferences store — the SINGLE source of truth for the Profile branch
// settings: app language, the master push/reminder switches, and the default
// reminder lead-times. Mirrors the city/saves stores (zustand + expo-secure-store,
// hydrated once in _layout) so the choices survive a relaunch.
//
// MVP scope: these are LOCAL preferences only. Picking a language writes the
// store and marks the active language, but the UI copy stays English — actual
// i18n translation is a later phase. The reminder lead-times + switches only
// persist the user's intent; NO push registration or scheduling happens here —
// that lands in Phase 6 (expo-notifications + the Supabase send-reminders
// function). When auth + the per-user Supabase profile land, hydrate/persist
// swap to that query and the call sites (selectors below) stay the same.

/** App-language preference. Native names shown in the picker; codes used here. */
export type LanguageId = 'en' | 'sr' | 'ru';

export interface Language {
  id: LanguageId;
  /** Row label in the picker, in its own language (e.g. "Srpski"). */
  name: string;
}

// Catalog order matches the Language frame (207:1181): English, Srpski, Русский.
export const LANGUAGES: readonly Language[] = [
  { id: 'en', name: 'English' },
  { id: 'sr', name: 'Srpski' },
  { id: 'ru', name: 'Русский' },
];

export const LANGUAGE_IDS: readonly LanguageId[] = LANGUAGES.map((l) => l.id);

/** Picker label for a language id, e.g. "English". */
export function languageName(id: LanguageId): string {
  return LANGUAGES.find((l) => l.id === id)?.name ?? '';
}

/** Lead-time before an event at which to remind. Multi-select (see the frame). */
export type ReminderOffset = '1_week' | '2_days' | '1_day' | 'day_of';

export interface ReminderOption {
  value: ReminderOffset;
  label: string;
}

// Catalog order + copy match the Event reminders frame (239:1275).
export const REMINDER_OPTIONS: readonly ReminderOption[] = [
  { value: '1_week', label: 'One week before' },
  { value: '2_days', label: 'Two days before' },
  { value: '1_day', label: 'One day before' },
  { value: 'day_of', label: 'On the day of the event' },
];

const REMINDER_VALUES: readonly ReminderOffset[] = REMINDER_OPTIONS.map((o) => o.value);

const STORAGE_KEY = 'ajmo.settings.v1';

const DEFAULTS = {
  language: 'en' as LanguageId,
  // Push + reminders default ON (frame shows both toggles on); the day-before
  // lead-time is pre-selected to match the Event reminders frame.
  pushEnabled: true,
  remindersEnabled: true,
  reminderOffsets: ['1_day'] as ReminderOffset[],
};

interface PersistedSettings {
  language: LanguageId;
  pushEnabled: boolean;
  remindersEnabled: boolean;
  reminderOffsets: ReminderOffset[];
}

function parse(raw: string | null): PersistedSettings {
  if (!raw) return { ...DEFAULTS, reminderOffsets: [...DEFAULTS.reminderOffsets] };
  try {
    const data = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      language: LANGUAGE_IDS.includes(data.language as LanguageId)
        ? (data.language as LanguageId)
        : DEFAULTS.language,
      pushEnabled: typeof data.pushEnabled === 'boolean' ? data.pushEnabled : DEFAULTS.pushEnabled,
      remindersEnabled:
        typeof data.remindersEnabled === 'boolean'
          ? data.remindersEnabled
          : DEFAULTS.remindersEnabled,
      reminderOffsets: Array.isArray(data.reminderOffsets)
        ? data.reminderOffsets.filter((o): o is ReminderOffset =>
            REMINDER_VALUES.includes(o as ReminderOffset),
          )
        : [...DEFAULTS.reminderOffsets],
    };
  } catch {
    return { ...DEFAULTS, reminderOffsets: [...DEFAULTS.reminderOffsets] };
  }
}

function persist(state: PersistedSettings): void {
  // Fire-and-forget; a failed write just means this change isn't durable.
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

interface SettingsState extends PersistedSettings {
  /** True once the persisted settings have been read from storage (see hydrate). */
  hydrated: boolean;
  /** Set the app language, then persist. No-op when unchanged. */
  setLanguage: (language: LanguageId) => void;
  /** Master push switch (Profile hub). Persisted preference only — see Phase 6. */
  setPushEnabled: (enabled: boolean) => void;
  /** Master event-reminders switch (Event reminders screen). */
  setRemindersEnabled: (enabled: boolean) => void;
  /** Add or remove a default lead-time, then persist. */
  toggleReminderOffset: (offset: ReminderOffset) => void;
  /** Load the persisted settings once on app start. Safe to call repeatedly. */
  hydrate: () => Promise<void>;
}

function snapshot(s: PersistedSettings): PersistedSettings {
  return {
    language: s.language,
    pushEnabled: s.pushEnabled,
    remindersEnabled: s.remindersEnabled,
    reminderOffsets: s.reminderOffsets,
  };
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  reminderOffsets: [...DEFAULTS.reminderOffsets],
  hydrated: false,
  setLanguage: (language) =>
    set((state) => {
      if (state.language === language) return state;
      const next = { ...snapshot(state), language };
      persist(next);
      return { language };
    }),
  setPushEnabled: (pushEnabled) =>
    set((state) => {
      if (state.pushEnabled === pushEnabled) return state;
      persist({ ...snapshot(state), pushEnabled });
      return { pushEnabled };
    }),
  setRemindersEnabled: (remindersEnabled) =>
    set((state) => {
      if (state.remindersEnabled === remindersEnabled) return state;
      persist({ ...snapshot(state), remindersEnabled });
      return { remindersEnabled };
    }),
  toggleReminderOffset: (offset) =>
    set((state) => {
      const reminderOffsets = state.reminderOffsets.includes(offset)
        ? state.reminderOffsets.filter((o) => o !== offset)
        : [...state.reminderOffsets, offset];
      persist({ ...snapshot(state), reminderOffsets });
      return { reminderOffsets };
    }),
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ ...parse(raw), hydrated: true });
    } catch {
      // First launch / unavailable store — keep defaults but mark hydrated so we
      // don't keep retrying.
      set({ hydrated: true });
    }
  },
}));

/** Reactive: the active app language. */
export const useLanguage = (): LanguageId => useSettings((s) => s.language);

/** Reactive: the master push switch. */
export const usePushEnabled = (): boolean => useSettings((s) => s.pushEnabled);

/** Reactive: the master event-reminders switch. */
export const useRemindersEnabled = (): boolean => useSettings((s) => s.remindersEnabled);

/** Reactive: the chosen default reminder lead-times (new reference on every change). */
export const useReminderOffsets = (): ReminderOffset[] => useSettings((s) => s.reminderOffsets);
