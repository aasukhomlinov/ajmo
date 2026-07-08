import type { TranslationKey } from './en';

// Russian UI copy. Kept SHORT to fit the width-constrained chips/buttons.
// Tone: neutral вы-form (standard for Russian app UI); brand strings avoid the
// pronoun entirely. Plural triples follow the Russian one/few/many rules
// (1 результат / 2 результата / 5 результатов) — see pluralForm() in index.ts.
export const ru: Record<TranslationKey, string> = {
  'common.apply': 'Применить',
  'common.reset': 'Сбросить',
  'common.retry': 'Повторить',
  'common.goBack': 'Назад',
  'common.continue': 'Продолжить',
  'common.close': 'Закрыть',
  'common.dismiss': 'Закрыть',
  'common.connectionError': 'Проверьте соединение и попробуйте ещё раз.',
  'common.filters': 'Фильтры',

  'tabs.discover': 'Афиша',
  'tabs.saved': 'Сохранённое',
  'tabs.profile': 'Профиль',

  'discover.errorTitle': 'Не удалось загрузить события',
  'discover.emptyTitle': 'Нет подходящих событий',
  'discover.emptyDescription':
    'Попробуйте убрать фильтр или расширить даты — новые события добавляются каждый день.',
  'discover.clearFilters': 'Сбросить фильтры',
  'discover.searchA11y': 'Поиск событий',
  'discover.changeCityA11y': 'Сменить город — {city}',

  'filters.category': 'Категория',
  'filters.anyDate': 'Любая дата',
  'filters.onlyFree': 'Бесплатные',
  'filters.categoriesCount.one': '{count} категория',
  'filters.categoriesCount.few': '{count} категории',
  'filters.categoriesCount.many': '{count} категорий',
  'filters.categoriesSection': 'Категории',
  'filters.when': 'Когда',

  'date.any': 'Любое время',
  'date.today': 'Сегодня',
  'date.thisWeek': 'Эта неделя',
  'date.nextWeek': 'Следующая неделя',
  'date.thisMonth': 'Этот месяц',
  'date.nextMonth': 'Следующий месяц',

  'category.music': 'Музыка',
  'category.party': 'Вечеринка',
  'category.art': 'Искусство',
  'category.food': 'Еда',
  'category.cinema': 'Кино',
  'category.theatre': 'Театр',
  'category.market': 'Маркет',
  'category.other': 'Другое',

  'search.title': 'Поиск',
  'search.placeholder': 'События, площадки...',
  'search.clearA11y': 'Очистить поиск',
  'search.recent': 'Недавние запросы',
  'search.popular': 'Популярное на этой неделе',
  'search.results.one': '{count} результат',
  'search.results.few': '{count} результата',
  'search.results.many': '{count} результатов',
  'search.noResultsTitle': 'Ничего не найдено',
  'search.noResultsDescription':
    'По запросу „{query}“ ничего не нашлось. Попробуйте изменить запрос или посмотрите все события.',
  'search.browseAll': 'Все события',

  'event.about': 'Описание',
  'event.location': 'Место',
  'event.save': 'Сохранить',
  'event.saved': 'Сохранено',
  'event.free': 'Бесплатно',
  'event.saveA11y': 'Сохранить событие',
  'event.savedA11y': 'Сохранено — нажмите, чтобы убрать',
  'event.shareA11y': 'Поделиться событием',
  'event.openBrowserA11y': 'Открыть страницу события в браузере',
  'event.openMapsA11y': 'Открыть {venue} в картах',
  'event.errorTitle': 'Не удалось загрузить событие',
  'event.notFoundTitle': 'Событие не найдено',
  'event.notFoundDescription': 'Возможно, оно уже прошло или было удалено.',

  'saved.title': 'Сохранённое',
  'saved.errorTitle': 'Не удалось загрузить сохранённое',
  'saved.emptyTitle': 'Пока ничего не сохранено',
  'saved.emptyDescription': 'Нажмите + на событии — и оно появится здесь.',
  'saved.discoverCta': 'Смотреть события',
  'saved.removeA11y': 'Убрать {title} из сохранённого',

  'city.belgrade': 'Белград',
  'city.noviSad': 'Нови-Сад',
  'city.chooseTitle': 'Выберите город',
  'city.onboardingPrompt': 'Где вы находитесь?',
  'city.sectionTitle': 'Города',
  'city.searchPlaceholder': 'Поиск города',
  'city.note': 'Пока ajmo работает только в этих городах. Скоро добавим новые!',

  'profile.title': 'Профиль',
  'profile.notifications': 'Уведомления',
  'profile.pushNotifications': 'Push-уведомления',
  'profile.eventReminders': 'Напоминания о событиях',
  'profile.language': 'Язык',
  'profile.aboutSection': 'О приложении',
  'profile.aboutAjmo': 'Об ajmo',
  'profile.privacy': 'Политика конфиденциальности',
  'profile.terms': 'Условия использования',

  'language.appLanguage': 'Язык приложения',

  'reminders.title': 'Напоминания',
  'reminders.enable': 'Включить напоминания',
  'reminders.enableDescription':
    'Получайте уведомления, чтобы не пропускать сохранённые события',
  'reminders.notifyMe': 'Когда напоминать',
  'reminders.oneWeek': 'За неделю',
  'reminders.twoDays': 'За два дня',
  'reminders.oneDay': 'За день',
  'reminders.dayOf': 'В день события',

  'about.title': 'О приложении',
  'about.tagline': 'Все события города — в одном месте',
  'about.version': 'Версия {version}',
  'about.credit': 'Сделано в Белграде · © 2026 ajmo',
};
