import * as SecureStore from 'expo-secure-store';

import { updateProfile, type Profile, type ProfilePatch } from '@/lib/api/profile';
import { CITY_IDS } from '@/lib/cities';
import {
  LANGUAGE_IDS,
  REMINDER_VALUES,
  type LanguageId,
  type ReminderOffset,
} from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import type { CityId } from '@/lib/types';

// One-time carry-over of the pre-Auth-2 DEVICE-local state into the signed-in
// user's profile. Before Auth-2, onboarding + the app persisted city, settings,
// saves and the onboarded flag to expo-secure-store; the profile is the source
// of truth now. On the first sign-in against a profile that has NOT onboarded
// yet, a device that HAS locally onboarded donates its values (the city chosen
// during onboarding becomes the profile's active_city, etc.) and the local
// copies are cleared. Idempotent and safe:
// - a returning user (profiles.onboarded_at set) is never overwritten — the
//   stale local copies are just cleared;
// - the saves upsert ignores duplicates and ids are validated against `events`
//   first (stale ids would violate the FK);
// - legacy keys are only deleted after every write succeeded, so a failed
//   attempt (offline) retries on the next launch.
// This module owns all knowledge of the legacy storage formats — when every
// dev device has migrated, it can be deleted wholesale.

const LEGACY_KEYS = {
  saves: 'ajmo.saves.v1',
  city: 'ajmo.city.v1',
  settings: 'ajmo.settings.v1',
  onboarded: 'ajmo.onboarded.v1',
} as const;

async function readKey(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key).catch(() => null);
}

async function clearLegacyKeys(): Promise<void> {
  await Promise.all(
    Object.values(LEGACY_KEYS).map((key) => SecureStore.deleteItemAsync(key).catch(() => {})),
  );
}

function parseLegacyCity(raw: string | null): CityId | null {
  return raw != null && (CITY_IDS as readonly string[]).includes(raw) ? (raw as CityId) : null;
}

function parseLegacySaves(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

interface LegacySettings {
  language?: LanguageId;
  pushEnabled?: boolean;
  remindersEnabled?: boolean;
  reminderOffsets?: ReminderOffset[];
}

function parseLegacySettings(raw: string | null): LegacySettings {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      language: (LANGUAGE_IDS as readonly unknown[]).includes(data.language)
        ? (data.language as LanguageId)
        : undefined,
      pushEnabled: typeof data.pushEnabled === 'boolean' ? data.pushEnabled : undefined,
      remindersEnabled:
        typeof data.remindersEnabled === 'boolean' ? data.remindersEnabled : undefined,
      reminderOffsets: Array.isArray(data.reminderOffsets)
        ? data.reminderOffsets.filter((o): o is ReminderOffset =>
            (REMINDER_VALUES as readonly unknown[]).includes(o),
          )
        : undefined,
    };
  } catch {
    return {};
  }
}

/** Upsert the device's locally saved event ids, skipping ids that no longer exist. */
async function carrySaves(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabase.from('events').select('id').in('id', ids);
  if (error) throw error;
  const rows = (data as { id: string }[]).map((row) => ({ user_id: userId, event_id: row.id }));
  if (rows.length === 0) return;
  const { error: upsertError } = await supabase
    .from('saves')
    .upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
  if (upsertError) throw upsertError;
}

/**
 * Fold the legacy device-local state into a freshly fetched profile. Returns
 * the profile the app should run with (patched when a carry-over happened).
 * Composed around fetchProfile by useProfileBootstrap's queryFn, so the splash
 * covers it and a thrown error retries with the query.
 */
export async function carryOverLegacyLocalState(
  userId: string,
  profile: Profile,
): Promise<Profile> {
  if (profile.onboardedAt != null) {
    // Returning user — the profile already owns the truth; the local copies
    // are stale leftovers at best. Never overwrite, just clean up.
    void clearLegacyKeys();
    return profile;
  }

  const [onboardedRaw, cityRaw, settingsRaw, savesRaw] = await Promise.all([
    readKey(LEGACY_KEYS.onboarded),
    readKey(LEGACY_KEYS.city),
    readKey(LEGACY_KEYS.settings),
    readKey(LEGACY_KEYS.saves),
  ]);

  // Device never finished the pre-Auth-2 onboarding — nothing worth donating;
  // the user goes through (or continues) onboarding normally.
  if (onboardedRaw !== 'true') return profile;

  const legacyCity = parseLegacyCity(cityRaw);
  const legacySettings = parseLegacySettings(settingsRaw);

  const patch: ProfilePatch = {
    ...legacySettings,
    // The device finished onboarding, so the profile counts as onboarded too —
    // don't make the user redo the flow just because storage moved.
    onboardedAt: new Date().toISOString(),
  };
  // Don't clobber a city another device may have set in the meantime.
  if (profile.activeCity == null) patch.activeCity = legacyCity ?? 'belgrade';

  await carrySaves(userId, parseLegacySaves(savesRaw));
  await updateProfile(patch);
  await clearLegacyKeys();

  return {
    ...profile,
    ...legacySettings,
    activeCity: patch.activeCity ?? profile.activeCity,
    onboardedAt: patch.onboardedAt ?? null,
  };
}
