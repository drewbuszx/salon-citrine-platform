/**
 * US salon calendar themes — light tints + optional watermark art for team events grid.
 * June uses a subtle pride rainbow wash on every day; named holidays add their own tint.
 */

export type HolidayTheme = {
  id: string;
  name: string;
  /** CSS color for color-mix background (keep pastel / low saturation). */
  bgColor: string;
  /** Filename under /images/holidays/ (svg/png). */
  image: string;
};

/** Subtle rainbow wash for all of June (Pride Month). */
export const JUNE_PRIDE_BG =
  "linear-gradient(135deg, rgba(255,105,135,0.07) 0%, rgba(255,179,71,0.07) 20%, rgba(255,235,59,0.06) 40%, rgba(129,199,132,0.07) 60%, rgba(66,165,245,0.07) 80%, rgba(186,104,200,0.07) 100%)";

const FIXED_HOLIDAYS: Record<string, HolidayTheme> = {
  "01-01": {
    id: "new-year",
    name: "New Year's Day",
    bgColor: "#fff8e6",
    image: "new-year.svg",
  },
  "02-14": {
    id: "valentines",
    name: "Valentine's Day",
    bgColor: "#fdeef2",
    image: "valentines.svg",
  },
  "03-17": {
    id: "st-patricks",
    name: "St. Patrick's Day",
    bgColor: "#edf7ef",
    image: "st-patricks.svg",
  },
  "06-19": {
    id: "juneteenth",
    name: "Juneteenth",
    bgColor: "#f3f0e8",
    image: "juneteenth.svg",
  },
  "07-04": {
    id: "independence",
    name: "Independence Day",
    bgColor: "#eef2fa",
    image: "independence.svg",
  },
  "10-31": {
    id: "halloween",
    name: "Halloween",
    bgColor: "#faf0e8",
    image: "halloween.svg",
  },
  "11-11": {
    id: "veterans",
    name: "Veterans Day",
    bgColor: "#eef0f2",
    image: "veterans.svg",
  },
  "12-25": {
    id: "christmas",
    name: "Christmas",
    bgColor: "#eef5ee",
    image: "christmas.svg",
  },
};

function calendarDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateStr(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y!, month: m! - 1, day: d! };
}

/** Nth weekday of month (weekday 0=Sun … 6=Sat). n=1 is first occurrence. */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
) {
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === weekday) {
      count += 1;
      if (count === n) return calendarDateStr(year, month, day);
    }
  }
  return null;
}

/** Last weekday of month. */
export function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = daysInMonth; day >= 1; day--) {
    if (new Date(year, month, day).getDay() === weekday) {
      return calendarDateStr(year, month, day);
    }
  }
  return null;
}

function floatingHolidaysForYear(year: number): Record<string, HolidayTheme> {
  const map: Record<string, HolidayTheme> = {};
  const add = (dateStr: string | null, theme: HolidayTheme) => {
    if (dateStr) map[dateStr] = theme;
  };

  add(nthWeekdayOfMonth(year, 0, 1, 3), {
    id: "mlk-day",
    name: "Martin Luther King Jr. Day",
    bgColor: "#f0f0f5",
    image: "mlk-day.svg",
  });
  add(nthWeekdayOfMonth(year, 1, 1, 3), {
    id: "presidents-day",
    name: "Presidents' Day",
    bgColor: "#eef1f8",
    image: "presidents-day.svg",
  });
  add(lastWeekdayOfMonth(year, 4, 1), {
    id: "memorial-day",
    name: "Memorial Day",
    bgColor: "#eef2f5",
    image: "memorial-day.svg",
  });
  add(nthWeekdayOfMonth(year, 8, 1, 1), {
    id: "labor-day",
    name: "Labor Day",
    bgColor: "#f0f2ee",
    image: "labor-day.svg",
  });
  add(nthWeekdayOfMonth(year, 9, 1, 2), {
    id: "indigenous-peoples",
    name: "Indigenous Peoples' Day",
    bgColor: "#f5f0ea",
    image: "indigenous-peoples.svg",
  });
  add(nthWeekdayOfMonth(year, 10, 4, 4), {
    id: "thanksgiving",
    name: "Thanksgiving",
    bgColor: "#faf2e8",
    image: "thanksgiving.svg",
  });

  return map;
}

export type CalendarDayTheme = {
  date: string;
  isPrideMonth: boolean;
  holiday: HolidayTheme | null;
};

export function getCalendarDayTheme(dateStr: string): CalendarDayTheme {
  const { year, month } = parseDateStr(dateStr);
  const mmdd = dateStr.slice(5);
  const isPrideMonth = month === 5;

  const fixed = FIXED_HOLIDAYS[mmdd] ?? null;
  const floating = floatingHolidaysForYear(year)[dateStr] ?? null;

  return {
    date: dateStr,
    isPrideMonth,
    holiday: floating ?? fixed,
  };
}

/** Birthday MM-DD match against YYYY-MM-DD date string. */
export function birthdayOnDate(birthday: string, dateStr: string) {
  if (!birthday || birthday.length < 10) return false;
  return birthday.slice(5) === dateStr.slice(5);
}
