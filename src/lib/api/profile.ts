import { CITY_IDS } from '@/lib/cities';
import {
  LANGUAGE_IDS,
  REMINDER_VALUES,
  type LanguageId,
  type ReminderOffset,
} from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import type { CityId } from '@/lib/types';

// Supabase read/write layer for the signed-in user's `profiles` row (Auth-2).
// The profile is the durable, user-scoped source of truth for the app settings:
// active city, language, and the notification/reminder PREFERENCES (persisted
// intent only — push scheduling is a later phase). The city/settings zustand
// stores stay as the synchronous in-memory mirror the screens read; they are
// hydrated from here at sign-in (useProfileBootstrap) and every setter writes
// through via `updateProfile`. RLS restricts the row to auth.uid(). This module
// deliberately imports no stores, so the stores can import it without a cycle.

export interface Profile {
  language: LanguageId;
  /** Null until the user picks a city (fresh profile pre-onboarding). */
  activeCity: CityId | null;
  pushEnabled: boolean;
  remindersEnabled: boolean;
  reminderOffsets: ReminderOffset[];
  /** Set once post-sign-in onboarding finished. Null = show onboarding. */
  onboardedAt: string | null;
}

/** Partial write; every field optional. City slugs are mapped to uuids here. */
export type ProfilePatch = Partial<Omit<Profile, 'activeCity'>> & {
  activeCity?: CityId;
};

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => ['profile', userId] as const,
};

// The active_city_id column is a uuid FK into `cities`; the app speaks slugs
// (CityId). The 2-row map is fetched once per process and cached.
let cityIdsPromise: Promise<Record<string, string>> | null = null;

async function fetchCityIdMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('cities').select('id, slug');
  if (error) throw error;
  return Object.fromEntries(
    (data as { id: string; slug: string }[]).map((row) => [row.slug, row.id]),
  );
}

async function cityUuid(slug: CityId): Promise<string> {
  cityIdsPromise ??= fetchCityIdMap().catch((error: unknown) => {
    cityIdsPromise = null; // don't cache a failed fetch
    throw error;
  });
  const id = (await cityIdsPromise)[slug];
  if (!id) throw new Error(`Unknown city slug: ${slug}`);
  return id;
}

const PROFILE_SELECT = `
  language,
  push_enabled,
  reminders_enabled,
  reminder_offsets,
  onboarded_at,
  active_city:cities ( slug )
` as const;

interface RawProfileRow {
  language: string;
  push_enabled: boolean;
  reminders_enabled: boolean;
  reminder_offsets: string[];
  onboarded_at: string | null;
  // To-one embed; supabase-js without generated types may widen to an array.
  active_city: { slug: string } | { slug: string }[] | null;
}

function mapProfileRow(row: RawProfileRow): Profile {
  const city = Array.isArray(row.active_city) ? (row.active_city[0] ?? null) : row.active_city;
  return {
    language: (LANGUAGE_IDS as readonly string[]).includes(row.language)
      ? (row.language as LanguageId)
      : 'en',
    activeCity:
      city && (CITY_IDS as readonly string[]).includes(city.slug) ? (city.slug as CityId) : null,
    pushEnabled: row.push_enabled,
    remindersEnabled: row.reminders_enabled,
    reminderOffsets: row.reminder_offsets.filter((o): o is ReminderOffset =>
      (REMINDER_VALUES as readonly string[]).includes(o),
    ),
    onboardedAt: row.onboarded_at,
  };
}

/**
 * The signed-in user's profile row. Rows auto-provision on signup (the
 * on_auth_user_created trigger); if one is somehow missing (e.g. a user created
 * before the trigger), it is created with defaults so the app always has one.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapProfileRow(data as unknown as RawProfileRow);

  const { error: insertError } = await supabase.from('profiles').insert({ id: userId });
  if (insertError) throw insertError;
  return {
    language: 'en',
    activeCity: null,
    pushEnabled: true,
    remindersEnabled: true,
    reminderOffsets: ['1_day'],
    onboardedAt: null,
  };
}

/**
 * Write-through for the settings mirrors. Resolves the session user itself so
 * the stores don't need the auth store (keeps the import graph acyclic). A
 * signed-out call is a silent no-op — there is nothing to persist to.
 */
export async function updateProfile(patch: ProfilePatch): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  const row: Record<string, unknown> = {};
  if (patch.language !== undefined) row.language = patch.language;
  if (patch.pushEnabled !== undefined) row.push_enabled = patch.pushEnabled;
  if (patch.remindersEnabled !== undefined) row.reminders_enabled = patch.remindersEnabled;
  if (patch.reminderOffsets !== undefined) row.reminder_offsets = patch.reminderOffsets;
  if (patch.onboardedAt !== undefined) row.onboarded_at = patch.onboardedAt;
  if (patch.activeCity !== undefined) row.active_city_id = await cityUuid(patch.activeCity);
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}
