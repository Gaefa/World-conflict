import type { Locale } from './i18n/types';

/**
 * Localizes ActionResult effect descriptions (toast chips) client-side.
 * The engine emits English strings; rather than threading i18n through
 * every action processor, we translate the visible chips here:
 *   1. exact-phrase dictionary for common qualitative effects
 *   2. term replacement for numeric stat patterns ("Stability -10")
 *   3. fallback — original English (rare/exotic strings)
 */

const PHRASES_RU: Record<string, string> = {
  // Diplomacy
  'Awaiting response': 'Ожидание ответа',
  'Awaiting acceptance': 'Ожидание принятия',
  'Allied nations may respond': 'Союзники могут вмешаться',
  'Allied nations may intervene': 'Союзники могут вмешаться',
  'Retaliation possible': 'Возможно возмездие',
  'Mutual defense pact if accepted': 'Пакт о взаимной обороне при принятии',
  'War ended': 'Война окончена',
  'Global condemnation': 'Мировое осуждение',
  'Diplomatic scandal if discovered': 'Дипломатический скандал при раскрытии',
  'Target stability may decrease': 'Стабильность цели может упасть',
  'Target GDP growth -0.5%': 'Рост ВВП цели -0.5%',
  // War / military
  'Army repositioning': 'Армия перемещается',
  'Movement may be detected': 'Движение могут заметить',
  'Occupy their capital to force capitulation': 'Займите их столицу для капитуляции',
  'Defending armies may intercept en route': 'Обороняющиеся армии могут перехватить',
  'Civilian casualties — global condemnation': 'Жертвы среди мирных — мировое осуждение',
  'Conflict may escalate': 'Конфликт может обостриться',
  'Long-term economic damage if protracted': 'Затяжная война ударит по экономике',
  'Military ops against target cost less': 'Военные операции против цели дешевле',
  'PERK: Mobilization — Army +15%': 'ПЕРК: Мобилизация — армия +15%',
  'PERK: War economy — Defense budget +20%': 'ПЕРК: Военная экономика — оборонный бюджет +20%',
  'PERK: GDP growth +0.5% (war stimulus)': 'ПЕРК: Рост ВВП +0.5% (военный стимул)',
  'PERK: Rally-around-flag — Approval +5': 'ПЕРК: Сплочение нации — рейтинг +5',
  'Blockade lasts 6 months': 'Блокада длится 6 месяцев',
  'All trade with target disrupted': 'Вся торговля с целью прервана',
  'Neighbors may notice military buildup': 'Соседи могут заметить наращивание сил',
  // Covert
  'Attribution unclear — plausible deniability': 'Атрибуция неясна — можно всё отрицать',
  'Attack traced back — cover blown': 'Атаку отследили — прикрытие раскрыто',
  'EXPOSED — your involvement is public': 'РАСКРЫТО — ваше участие публично',
  'Critical infrastructure disrupted': 'Критическая инфраструктура нарушена',
  'Government systems compromised': 'Правительственные системы взломаны',
  'Government overthrown': 'Правительство свергнуто',
  'Blackouts causing unrest': 'Отключения света вызывают волнения',
  'Energy grid disrupted': 'Энергосеть нарушена',
  'Communications networks down': 'Сети связи отключены',
  'Classified data extracted': 'Секретные данные извлечены',
  'Cyber defenses held — attack repelled': 'Кибероборона выстояла — атака отбита',
  'Banking systems disrupted — $5B drained': 'Банковские системы нарушены — утекло $5 млрд',
  // Economy
  'Resources will flow via resource tick': 'Ресурсы пойдут с каждым ходом',
  'Buffer against supply disruptions': 'Подушка на случай перебоев поставок',
  'High taxes may slow GDP growth': 'Высокие налоги могут замедлить рост ВВП',
  'Deducted from national budget each tick': 'Списывается из бюджета каждый ход',
  'Bypasses sanctions': 'Обходит санкции',
  'Detection risk by sanctioners': 'Риск обнаружения санкционерами',
  'Global price expected to rise': 'Мировая цена, вероятно, вырастет',
  'Importers will suffer': 'Импортёры пострадают',
  'Competitors may suffer': 'Конкуренты могут пострадать',
  'Cartel may fracture': 'Картель может расколоться',
  'Economic disruption': 'Экономические потрясения',
  // Statuses / misc
  'Stability +5 on acceptance': 'Стабильность +5 при принятии',
  'Approval +5 on acceptance': 'Рейтинг +5 при принятии',
  'Arms proliferation risk': 'Риск распространения оружия',
  'Buyer may become future threat': 'Покупатель может стать угрозой',
  'Humanitarian crisis risk': 'Риск гуманитарного кризиса',
  'Effect depends on enemy intel level': 'Эффект зависит от разведки противника',
  'Enemy spies will see manipulated data': 'Вражеские шпионы увидят подделку',
};

/** Stat/term replacements for numeric patterns like "Stability -10". */
const TERMS_RU: [RegExp, string][] = [
  [/\bDiplomatic influence\b/g, 'Дипл. влияние'],
  [/\bInfluence\b/g, 'Влияние'],
  [/\bStability\b/g, 'Стабильность'],
  [/\bApproval\b/g, 'Рейтинг'],
  [/\bBudget revenue\b/g, 'Доход бюджета'],
  [/\bBudget\b/g, 'Бюджет'],
  [/\bGDP growth\b/g, 'Рост ВВП'],
  [/\bGDP\b/g, 'ВВП'],
  [/\bArmy\b/g, 'Армия'],
  [/\bNavy\b/g, 'Флот'],
  [/\bAir force\b/gi, 'ВВС'],
  [/\bAircraft losses\b/g, 'Потери авиации'],
  [/\bTech level\b/g, 'Уровень техн.'],
  [/\bRevenue\b/g, 'Доход'],
  [/\bCost\b/g, 'Стоимость'],
  [/\bpersonnel\b/g, 'чел.'],
  [/\btroops\b/g, 'войск'],
  [/\bCommitted\b/g, 'Задействовано'],
  [/\bincreased\b/g, 'выросли'],
  [/\bdecreased\b/g, 'снизились'],
  [/\brecruited\b/g, 'навербовано'],
  [/\bexpended\b/g, 'израсходовано'],
  [/\bwarhead\(s\)/g, 'боеголовок'],
  [/\(lost\)/g, '(потеряно)'],
  [/\bETA ~(\d+) months — track it on the war map\b/g, 'Прибытие ~$1 мес. — следите на карте войны'],
  [/\bYour losses\b/g, 'Ваши потери'],
  [/\bEnemy losses\b/g, 'Потери врага'],
  [/\bstockpile\b/g, 'резерв'],
  [/\bmonths\b/g, 'мес.'],
];

/** Budget/allocation category names (used in toast headlines). */
const CATEGORY_RU: Record<string, string> = {
  military: 'армия',
  economy: 'экономика',
  technology: 'технологии',
  social: 'соцсфера',
};

/** Localize an allocate_budget category name. */
export function localizeCategory(category: string, locale: Locale | null): string {
  if (locale !== 'ru') return category;
  return CATEGORY_RU[category] ?? category;
}

/** Localize one effect description for the active locale. */
export function localizeEffect(description: string, locale: Locale | null): string {
  if (locale !== 'ru') return description;

  const exact = PHRASES_RU[description];
  if (exact) return exact;

  let out = description;
  for (const [re, repl] of TERMS_RU) {
    out = out.replace(re, repl);
  }
  return out;
}
