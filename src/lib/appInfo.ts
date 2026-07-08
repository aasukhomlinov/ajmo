import Constants from 'expo-constants';

// App identity strings shown on the Profile hub footer and the About screen.
// Version + build come from the Expo config (app.json) so they track the real
// release rather than being hardcoded. Build number falls back to "1" when the
// config doesn't pin one yet (matches the "(1)" in the Profile & About frames).
const version = Constants.expoConfig?.version ?? '1.0.0';
const build =
  Constants.expoConfig?.ios?.buildNumber ??
  (Constants.expoConfig?.android?.versionCode != null
    ? String(Constants.expoConfig.android.versionCode)
    : '1');

/** e.g. "v1.0.0 (1)" — Profile footer (no words, language-neutral). */
export const APP_VERSION_LABEL = `v${version} (${build})`;
/** e.g. "1.0.0 (1)" — raw number for the About screen's localized
 *  "Version {version}" line (t('about.version')). */
export const APP_VERSION_NUMBER = `${version} (${build})`;

// External legal links opened from the Profile hub via Linking.openURL.
// TODO: point these at the real ajmo site once it exists (placeholders for now).
export const PRIVACY_URL = 'https://ajmo.app/privacy';
export const TERMS_URL = 'https://ajmo.app/terms';
