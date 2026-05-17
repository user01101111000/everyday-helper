import { DateFormats } from '../constants/DateFormats';
import { DateLangLabels } from '../constants/DateLangLabels';

export type DateInput = Date | string | number | null | undefined;

export type FormatLang = "az" | "en" | "ru";

export type DaysFormatOrder = 'YMD' | 'DMY' | 'MDY';

export type PluralLabel = { one: string; other?: string; few?: string; many?: string };

export interface GenerateOrderedDateTextModel {
  lang: FormatLang;
  order: DaysFormatOrder;
  date: {
    days: number;
    years: number;
    months: number;
  };
}

export interface DaysToYMDDaysOptionsModel {
  asText?: boolean;
  lang?: FormatLang;
  order?: DaysFormatOrder;
}

export interface DaysToYMDParams {
  endDate: DateInput;
  startDate: DateInput;
  options?: DaysToYMDDaysOptionsModel;
}

export interface ComputeAnchorParams {
  startDate: Date;
  totalMonths: number;
}

export interface DaysToYMDOutputModel {
  dayCount: number;
  yearCount: number;
  monthCount: number;
}

/* ----------------------------- Helper ----------------------------- */

const toDate = (date: DateInput): Date | undefined => {
  if (!date) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? undefined : d;
};

const pad = (n: number) => String(n).padStart(2, '0');

const computeAnchor = ({ totalMonths, startDate }: ComputeAnchorParams): Date => {
  const anchorYear =
    startDate.getUTCFullYear() + Math.floor((startDate.getUTCMonth() + totalMonths) / 12);
  const anchorMonth = (startDate.getUTCMonth() + totalMonths) % 12;
  const daysInMonth = new Date(Date.UTC(anchorYear, anchorMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anchorYear, anchorMonth, Math.min(startDate.getUTCDate(), daysInMonth)));
}

const generateOrderedDateText = ({ order, lang, date }: GenerateOrderedDateTextModel) => {
  let ordered: (string | null)[] = [];
  const { years, days, months } = date;

  const labels = getLabels(lang, years, months, days);

  const yearPart = years > 0 ? `${years} ${labels.year}` : null;
  const monthPart = months > 0 ? `${months} ${labels.month}` : null;
  const dayPart = days > 0 || (!yearPart && !monthPart) ? `${days} ${labels.day}` : null;

  switch (order) {
    case 'YMD':
      ordered = [yearPart, monthPart, dayPart];
      break;

    case 'DMY':
      ordered = [dayPart, monthPart, yearPart];
      break;

    case 'MDY':
      ordered = [monthPart, dayPart, yearPart];
      break;
  }

  return ordered.filter(Boolean).join(' ');
}


const pluralRulesCache = new Map<FormatLang, Intl.PluralRules>();

const pluralize = (lang: FormatLang, n: number, label: PluralLabel): string => {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  const category = rules.select(n) as keyof PluralLabel;
  return label[category] ?? label.one;
}

const getLabels = (lang: GenerateOrderedDateTextModel['lang'], years: number, months: number, days: number) => {
  switch (lang) {
    case 'az': {
      const azLabel = DateLangLabels.AZ;
      return { year: azLabel.year, month: azLabel.month, day: azLabel.day };
    }
    case 'en': {
      const enLabel = DateLangLabels.EN;
      return {
        day: pluralize(lang, days, enLabel.day),
        year: pluralize(lang, years, enLabel.year),
        month: pluralize(lang, months, enLabel.month),
      };
    }
    case 'ru': {
      const ruLabel = DateLangLabels.RU;
      return {
        day: pluralize(lang, days, ruLabel.day),
        year: pluralize(lang, years, ruLabel.year),
        month: pluralize(lang, months, ruLabel.month),
      };
    }
    default: {
      throw new Error(`Unsupported lang: ${lang}`);
    }
  }
}

/* ----------------------------- formatDate() ----------------------------- */
export const formatDate = (
  date: DateInput,
  format: DateFormats | string = DateFormats.DD_MMM_YYYY_WITH_SPACE,
): string | undefined => {
  const d = toDate(date);
  if (!d) return undefined;

  if (format === DateFormats.DD_MMM_YYYY_WITH_SPACE) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(d)
      .replace(',', '');
  }

  const tokens: Record<string, string> = {
    YYYY: d.getFullYear().toString(),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
  };

  return Object.entries(tokens).reduce(
    (acc, [token, value]) => acc.replace(new RegExp(token, 'g'), value),
    format,
  );
};

/* ----------------------------- formatRelativeTime() ----------------------------- */
export const formatRelativeTime = (date: DateInput, baseDate?: DateInput): string | undefined => {
  const d = toDate(date);
  const base = toDate(baseDate) ?? new Date();
  if (!d) return undefined;

  const diff = d.getTime() - base.getTime();
  const abs = Math.abs(diff);

  if (abs < 60000) return diff < 0 ? 'seconds ago' : 'in seconds';

  const minutes = Math.round(abs / 60000);
  if (minutes < 60) return diff < 0 ? `${minutes} minutes ago` : `in ${minutes} minutes`;

  const hours = Math.round(abs / 3600000);
  if (hours < 24) return diff < 0 ? `${hours} hours ago` : `in ${hours} hours`;

  const days = Math.round(abs / 86400000);
  return diff < 0 ? `${days} days ago` : `in ${days} days`;
};

/* ----------------------------- Validators ----------------------------- */
export const isValidDate = (date: DateInput): boolean => !!toDate(date);

export const isPast = (date: DateInput): boolean => {
  const d = toDate(date);
  return d ? d.getTime() < Date.now() : false;
};

export const isFuture = (date: DateInput): boolean => {
  const d = toDate(date);
  return d ? d.getTime() > Date.now() : false;
};

export const isToday = (date: DateInput): boolean => {
  const d = toDate(date);
  if (!d) return false;
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

export const isYesterday = (date: DateInput): boolean => {
  const d = toDate(date);
  if (!d) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
};

export const isTomorrow = (date: DateInput): boolean => {
  const d = toDate(date);
  if (!d) return false;
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.toDateString() === t.toDateString();
};

export const isSameDay = (date1: DateInput, date2: DateInput): boolean => {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  return d1 && d2 ? d1.toDateString() === d2.toDateString() : false;
};

/* ----------------------------- Between ----------------------------- */
export const isBetweenDates = (
  date: DateInput,
  startDate: DateInput,
  endDate: DateInput,
): boolean => {
  const d = toDate(date);
  const s = toDate(startDate);
  const e = toDate(endDate);
  if (!d || !s || !e) return false;
  const t = d.getTime();
  return t >= s.getTime() && t <= e.getTime();
};

/* ----------------------------- Diff ----------------------------- */
export const getDateDifference = (
  date1: DateInput,
  date2: DateInput,
  unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' = 'day',
): number | undefined => {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  if (!d1 || !d2) return undefined;

  const diff = d1.getTime() - d2.getTime();

  switch (unit) {
    case 'millisecond':
      return diff;
    case 'second':
      return diff / 1000;
    case 'minute':
      return diff / 60000;
    case 'hour':
      return diff / 3600000;
    default:
      return diff / 86400000;
  }
};

/* ----------------------------- Add/Subtract ----------------------------- */
export const addToDate = (
  date: DateInput,
  amount: number,
  unit: 'day' | 'hour' | 'minute' | 'second' = 'day',
): Date | undefined => {
  const d = toDate(date);
  if (!d) return undefined;

  const copy = new Date(d);

  if (unit === 'second') copy.setSeconds(copy.getSeconds() + amount);
  else if (unit === 'minute') copy.setMinutes(copy.getMinutes() + amount);
  else if (unit === 'hour') copy.setHours(copy.getHours() + amount);
  else copy.setDate(copy.getDate() + amount);

  return copy;
};

export const subtractFromDate = (
  date: DateInput,
  amount: number,
  unit: 'day' | 'hour' | 'minute' | 'second' = 'day',
): Date | undefined => addToDate(date, -amount, unit);

/* ----------------------------- Start/End ----------------------------- */
export const startOf = (
  date: DateInput,
  unit: 'day' | 'month' | 'year' = 'day',
): Date | undefined => {
  const d = toDate(date);
  if (!d) return undefined;

  const copy = new Date(d);

  if (unit === 'day') copy.setHours(0, 0, 0, 0);
  else if (unit === 'month') {
    copy.setDate(1);
    copy.setHours(0, 0, 0, 0);
  } else if (unit === 'year') {
    copy.setMonth(0, 1);
    copy.setHours(0, 0, 0, 0);
  }

  return copy;
};

export const endOf = (
  date: DateInput,
  unit: 'day' | 'month' | 'year' = 'day',
): Date | undefined => {
  const d = toDate(date);
  if (!d) return undefined;

  const copy = new Date(d);

  if (unit === 'day') copy.setHours(23, 59, 59, 999);
  else if (unit === 'month') {
    copy.setMonth(copy.getMonth() + 1, 0);
    copy.setHours(23, 59, 59, 999);
  } else if (unit === 'year') {
    copy.setMonth(11, 31);
    copy.setHours(23, 59, 59, 999);
  }

  return copy;
};

/* ----------------------------- Range formatting ----------------------------- */
export const formatDateRange = (
  startDate: DateInput,
  endDate: DateInput,
  format: DateFormats | string = DateFormats.DD_MMM_YYYY_WITH_SPACE,
  separator: string = ' - ',
): string | undefined => {
  const s = formatDate(startDate, format);
  const e = formatDate(endDate, format);
  return s && e ? `${s}${separator}${e}` : undefined;
};

/* ----------------------------- Age ----------------------------- */
export const getAge = (birthdate: DateInput): number | undefined => {
  const d = toDate(birthdate);
  if (!d) return undefined;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();

  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;

  return age;
};

/* ----------------------------- parseDate ----------------------------- */
export const parseDate = (dateString: string, format: string): Date | undefined => {
  if (format === 'DD/MM/YYYY') {
    const [dd, mm, yyyy] = dateString.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  return toDate(dateString);
};

/* ----------------------------- ISO & Unix ----------------------------- */
export const toISOString = (date: DateInput): string | undefined => {
  const d = toDate(date);
  return d?.toISOString();
};

export const toUnixTimestamp = (date: DateInput): number | undefined => {
  const d = toDate(date);
  return d ? Math.floor(d.getTime() / 1000) : undefined;
};

/* ----------------------------- now() ----------------------------- */
export const now = (): Date => new Date();

/* ----------------------------- compareDates() ----------------------------- */
export const compareDates = (date1: DateInput, date2: DateInput): -1 | 0 | 1 | undefined => {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  if (!d1 || !d2) return undefined;

  if (d1.getTime() < d2.getTime()) return -1;
  if (d1.getTime() > d2.getTime()) return 1;
  return 0;
};

/* ----------------------------- getDaysDiffAsText() ----------------------------- */

/**
 * Calculates the difference between two dates broken down into years, months, and days.
 *
 * By default returns a localized human-readable string (e.g. `"1 il 3 ay 9 gün"`).
 * Pass `options.asText: false` to receive a structured object instead.
 *
 * @param startDate - The earlier date. Accepts `Date`, ISO string, or Unix timestamp (ms).
 * @param endDate - The later date. Must be greater than or equal to `startDate`.
 * @param options - Optional formatting options.
 *   - `asText` (default `true`): if `true`, returns a formatted string; if `false`, returns `DaysToYMDOutputModel`.
 *   - `lang` (default `'az'`): output language — `'az'`, `'en'`, or `'ru'`.
 *   - `order` (default `'YMD'`): component order — `'YMD'`, `'DMY'`, or `'MDY'`.
 *
 * @returns A formatted string when `asText` is true, otherwise `{ yearCount, monthCount, dayCount }`.
 *
 * @throws {Error} If either `startDate` or `endDate` is invalid / unparseable.
 * @throws {Error} If `endDate` is earlier than `startDate`.
 *
 * @example
 * // Default usage — Azerbaijani text
 * getDaysDiffAsText({
 *   startDate: '2026-03-01',
 *   endDate: '2027-06-10',
 * });
 * // → "1 il 3 ay 9 gün"
 *
 * @example
 * // English output, day-month-year order
 * getDaysDiffAsText({
 *   startDate: new Date('2026-03-01'),
 *   endDate: new Date('2027-06-10'),
 *   options: { lang: 'en', order: 'DMY' },
 * });
 * // → "9 days 3 months 1 year"
 *
 * @example
 * // Structured output instead of string
 * getDaysDiffAsText({
 *   startDate: '2026-01-01',
 *   endDate: '2027-01-01',
 *   options: { asText: false },
 * });
 * // → { yearCount: 1, monthCount: 0, dayCount: 0 }
 */

export function getDaysDiffAsText({
  options, endDate, startDate,
}: DaysToYMDParams): DaysToYMDOutputModel | string {
  const { asText = true, lang = 'az', order = 'YMD' } = options ?? {};

  const startParsed = toDate(startDate);
  const endParsed = toDate(endDate);

  if (!startParsed || !endParsed) {
    throw new Error('Invalid date provided');
  }

  const start = new Date(Date.UTC(startParsed.getUTCFullYear(), startParsed.getUTCMonth(), startParsed.getUTCDate()));
  const end = new Date(Date.UTC(endParsed.getUTCFullYear(), endParsed.getUTCMonth(), endParsed.getUTCDate()));

  if (end < start) {
    throw new Error('endDate must be greater than startDate');
  }

  const diffYears = end.getUTCFullYear() - start.getUTCFullYear();
  const diffMonths = end.getUTCMonth() - start.getUTCMonth();
  let totalMonths = diffYears * 12 + diffMonths;

  let anchor = computeAnchor({ totalMonths, startDate: start });
  if (anchor > end) {
    totalMonths--;
    anchor = computeAnchor({ totalMonths, startDate: start });
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const days = Math.floor((end.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));

  if (asText) {
    return generateOrderedDateText({
      order,
      lang,
      date: {
        days,
        years,
        months,
      },
    });
  }

  return {
    yearCount: years,
    monthCount: months,
    dayCount: days,
  };
}
