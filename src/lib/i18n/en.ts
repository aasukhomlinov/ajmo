// English UI copy — the SOURCE OF TRUTH for interface strings. Every key added
// here must be mirrored in ru.ts / sr.ts (they are typed as
// Record<TranslationKey, string>, so a missing key is a tsc error, not a silent
// fallback). Flat dot-keys; `{name}` placeholders are filled by t()'s vars.
// Plural-sensitive strings come in `.one` / `.few` / `.many` triples consumed
// via t.count() — en only distinguishes one/other, so few === many.
//
// UI chrome ONLY. Event content (titles/descriptions) is localized in the DB
// (title_i18n/description_i18n) and resolved by the API layer — never here.
export const en = {
  // Shared actions / errors
  'common.apply': 'Apply',
  'common.cancel': 'Cancel',
  'common.reset': 'Reset',
  'common.retry': 'Retry',
  'common.goBack': 'Go back',
  'common.continue': 'Continue',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.connectionError': 'Check your connection and try again.',
  'common.filters': 'Filters',

  // Auth flow (welcome / email / sent / expired / callback)
  'auth.heroTitle': 'Every event in your city, one place',
  'auth.heroSubtitle':
    'Concerts, parties and art — pulled from venues and social networks. Filter to your taste, save what you like, and get a reminder before it starts.',
  'auth.continueApple': 'Continue with Apple',
  'auth.continueGoogle': 'Continue with Google',
  'auth.continueEmail': 'Continue with email',
  'auth.legal': 'By continuing you agree to {terms} & {privacy}.',
  'auth.legalTerms': 'Terms',
  'auth.legalPrivacy': 'Privacy',
  'auth.emailTitle': 'What’s your email?',
  'auth.emailSubtitle': 'We’ll email you a 6-digit code — no password.',
  'auth.emailPlaceholder': 'you@email.com',
  'auth.sendCode': 'Send code',
  'auth.emailInvalid': 'That doesn’t look like an email — check it and try again.',
  'auth.sendFailed': 'Couldn’t send the code. Try again in a minute.',
  'auth.codeTitle': 'Enter the code',
  'auth.codeBody': 'We sent a 6-digit code to {email}.',
  'auth.verify': 'Verify',
  'auth.codeInvalid': 'That code didn’t work — check it or request a fresh one.',
  'auth.resendCode': 'Resend code',
  'auth.resendIn': 'Resend in {seconds}s',
  'auth.resent': 'A fresh code is on its way.',
  'auth.expiredTitle': 'This link expired',
  'auth.expiredBody':
    'Magic links work once and expire after a while. Send a fresh code and you’re in.',
  'auth.sendNew': 'Send a fresh code',
  'auth.useDifferentEmail': 'Use a different email',
  'auth.signingIn': 'Signing you in…',

  // Onboarding · notifications permission
  'onboarding.notificationsTitle': 'Never miss an event',
  'onboarding.notificationsBody':
    'Turn on notifications and we’ll remind you before events you’re going to. No spam — only what you asked for.',
  'onboarding.notificationsCta': 'Turn on notifications',
  'onboarding.notificationsSkip': 'Not now',

  // Tab bar (icon-only — these are accessibility labels)
  'tabs.discover': 'Discover',
  'tabs.saved': 'Saved',
  'tabs.profile': 'Profile',

  // Discover feed
  'discover.errorTitle': 'Couldn’t load events',
  'discover.emptyTitle': 'No events match',
  'discover.emptyDescription':
    'Try clearing a filter or widening the dates — new events are added daily.',
  'discover.clearFilters': 'Clear filters',
  'discover.searchA11y': 'Search events',
  'discover.changeCityA11y': 'Change city — {city}',

  // Filter bar + sheets
  'filters.category': 'Category',
  'filters.anyDate': 'Any date',
  'filters.onlyFree': 'Only free',
  'filters.categoriesCount.one': '{count} category',
  'filters.categoriesCount.few': '{count} categories',
  'filters.categoriesCount.many': '{count} categories',
  'filters.categoriesSection': 'Categories',
  'filters.when': 'When',

  // Date presets (sheet radios + the date chip label)
  'date.any': 'Any Time',
  'date.today': 'Today',
  'date.thisWeekend': 'This Weekend',
  'date.thisWeek': 'This Week',

  // Event categories (filter chips + cover/detail badges)
  'category.music': 'Music',
  'category.party': 'Party',
  'category.art': 'Art',
  'category.food': 'Food',
  'category.cinema': 'Cinema',
  'category.theatre': 'Theatre',
  'category.market': 'Market',
  'category.other': 'Other',

  // Search
  'search.title': 'Search',
  'search.placeholder': 'Search events, venues...',
  'search.clearA11y': 'Clear search',
  'search.recent': 'Recent searches',
  'search.popular': 'Popular this week',
  'search.results.one': '{count} result',
  'search.results.few': '{count} results',
  'search.results.many': '{count} results',
  'search.noResultsTitle': 'No results',
  'search.noResultsDescription':
    'Nothing matches “{query}”. Try a broader search or browse all events.',
  'search.browseAll': 'Browse all events',

  // Event detail (+ card save control)
  'event.about': 'About',
  'event.location': 'Location',
  'event.save': 'Save',
  'event.saved': 'Saved',
  'event.free': 'Free',
  'event.saveA11y': 'Save event',
  'event.savedA11y': 'Saved — tap to remove',
  'event.shareA11y': 'Share event',
  'event.openBrowserA11y': 'Open event page in browser',
  'event.openMapsA11y': 'Open {venue} in a maps app',
  'event.errorTitle': 'Couldn’t load event',
  'event.notFoundTitle': 'Event not found',
  'event.notFoundDescription': 'This event may have ended or been removed.',

  // Saved
  'saved.title': 'Saved',
  'saved.errorTitle': 'Couldn’t load saved events',
  'saved.emptyTitle': 'No saved events yet',
  'saved.emptyDescription': 'Tap + on an event and it’ll show up here.',
  'saved.discoverCta': 'Discover events',
  'saved.removeA11y': 'Remove {title} from saved',

  // City picker + onboarding step
  'city.belgrade': 'Belgrade',
  'city.noviSad': 'Novi Sad',
  'city.chooseTitle': 'Choose your city',
  'city.onboardingPrompt': 'What’s your location?',
  'city.sectionTitle': 'Cities',
  'city.searchPlaceholder': 'Search cities',
  'city.note':
    'Right now these are the only cities where ajmo works. New cities will be added soon!',

  // Profile hub
  'profile.title': 'Profile',
  'profile.account': 'Account',
  'profile.signOut': 'Sign out',
  'profile.signOutConfirm': 'You’ll need a new magic link to sign back in.',
  'profile.deleteAccount': 'Delete account',
  'profile.deleteAccountBody':
    'This permanently deletes your account, your saved events and reminders, and your city preference. This cannot be undone.',
  'profile.deleteAccountConfirmTitle': 'Delete everything?',
  'profile.deleteAccountConfirmBody':
    'Last check — your account and all your data will be gone for good.',
  'profile.deleteAccountConfirmCta': 'Delete permanently',
  'profile.deleteAccountFailed': 'Couldn’t delete your account. Nothing was removed — try again.',
  'profile.deleteAccountDone': 'Your account and data have been deleted.',
  'profile.notifications': 'Notifications',
  'profile.pushNotifications': 'Push notifications',
  'profile.pushSystemOff': 'Off in system settings — tap to open settings',
  'profile.eventReminders': 'Event reminders',
  'profile.language': 'Language',
  'profile.aboutSection': 'About',
  'profile.aboutAjmo': 'About ajmo',
  'profile.privacy': 'Privacy Policy',
  'profile.terms': 'Terms of Service',

  // Language picker
  'language.appLanguage': 'App language',

  // Event reminders
  'reminders.title': 'Event reminders',
  'reminders.enable': 'Enable reminders',
  'reminders.enableDescription':
    'Get a notification to never miss an event you saved to your list',
  'reminders.notifyMe': 'Notify me',
  'reminders.oneWeek': 'One week before',
  'reminders.twoDays': 'Two days before',
  'reminders.oneDay': 'One day before',
  'reminders.dayOf': 'On the day of the event',

  // Reminder notifications — {title}/{venue}/{time} baked in at scheduling time
  'notifications.oneWeekTitle': 'In one week: {title}',
  'notifications.twoDaysTitle': 'In two days: {title}',
  'notifications.oneDayTitle': 'Tomorrow: {title}',
  'notifications.dayOfTitle': 'Today: {title}',
  'notifications.body': '{venue} · {time}',

  // About
  'about.title': 'About',
  'about.tagline': 'Every event in your city, one place',
  'about.version': 'Version {version}',
  'about.credit': 'Made in Belgrade · © 2026 ajmo',
} as const;

/** Every valid UI-string key. Derived from the en dictionary (source of truth). */
export type TranslationKey = keyof typeof en;
