// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface PublicHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
}

export interface DayEntry {
  year: number;
  month: number; // 0-based
  day: number;
  dateKey: string;
}

export interface OfficeEventInfo {
  event_type: string;
  allow_time_entry: boolean;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Colours
export const COLOR_WORKDAY = '#C8E6C9'; // light green
export const COLOR_WEEKEND = '#FFCDD2'; // light red
export const COLOR_HOLIDAY = '#E53935'; // darker red
// Office event colours — lighter = time entry allowed, darker = time entry blocked
export const COLOR_OFFICE_CLOSED = '#EF5350'; // red (always blocked)
export const COLOR_SOCIAL_BLOCKED = '#F9A825'; // dark yellow (blocked)
export const COLOR_SOCIAL_ALLOWED = '#FFF176'; // light yellow (allowed)
export const COLOR_IMPORTANT_BLOCKED = '#FB8C00'; // dark orange (blocked)
export const COLOR_IMPORTANT_ALLOWED = '#FFCC80'; // light orange (allowed)

export const NAME_COL_WIDTH = 150;
export const DAY_COL_WIDTH = 32;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay(); // 0 = Sun
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/** Build a continuous array of DayEntry for a given number of months starting from (startYear, startMonth). */
export function buildMonthRange(
  startYear: number,
  startMonth: number,
  monthCount: number,
): DayEntry[] {
  const entries: DayEntry[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < monthCount; i++) {
    const days = getDaysInMonth(y, m);
    for (let d = 1; d <= days; d++) {
      entries.push({ year: y, month: m, day: d, dateKey: formatDateKey(y, m, d) });
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return entries;
}

/** Normalise a (year, month) pair where month may be negative or > 11. */
export function normaliseYearMonth(year: number, month: number): [number, number] {
  let y = year;
  let m = month;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return [y, m];
}

/** Find the index of the first day of a given month in the entries array. */
export function findMonthStartIndex(entries: DayEntry[], year: number, month: number): number {
  return entries.findIndex((e) => e.year === year && e.month === month);
}

/** Format a full date tooltip string with optional holiday/event info. */
export function formatCellTooltip(
  entry: DayEntry,
  holidayNameMap: Map<string, string>,
  officeEventDateMap: Map<string, OfficeEventInfo>,
): string {
  const dow = getDayOfWeek(entry.year, entry.month, entry.day);
  const datePart = `${DAY_NAMES_FULL[dow]}, ${entry.day} ${MONTH_NAMES[entry.month]} ${entry.year}`;
  const lines: string[] = [datePart];
  const holidayName = holidayNameMap.get(entry.dateKey);
  if (holidayName) lines.push(`Public Holiday: ${holidayName}`);
  const ev = officeEventDateMap.get(entry.dateKey);
  if (ev) {
    const typeLabel =
      ev.event_type === 'OFFICE_CLOSED'
        ? 'Office Closed'
        : ev.event_type === 'TEAM_SOCIAL'
          ? 'Team Social'
          : 'Important Event';
    lines.push(`${ev.name} (${typeLabel})`);
    if (ev.event_type !== 'OFFICE_CLOSED') {
      lines.push(ev.allow_time_entry ? 'Time entry: allowed' : 'Time entry: blocked');
    }
  }
  return lines.join('\n');
}

/** Get cell background color based on holidays, events, weekends. */
export function getCellColor(
  entry: DayEntry,
  holidaySet: Set<string>,
  officeEventDateMap: Map<string, OfficeEventInfo>,
): string {
  if (holidaySet.has(entry.dateKey)) return COLOR_HOLIDAY;
  const ev = officeEventDateMap.get(entry.dateKey);
  if (ev) {
    if (ev.event_type === 'OFFICE_CLOSED') return COLOR_OFFICE_CLOSED;
    if (ev.event_type === 'TEAM_SOCIAL')
      return ev.allow_time_entry ? COLOR_SOCIAL_ALLOWED : COLOR_SOCIAL_BLOCKED;
    if (ev.event_type === 'IMPORTANT_EVENT')
      return ev.allow_time_entry ? COLOR_IMPORTANT_ALLOWED : COLOR_IMPORTANT_BLOCKED;
  }
  if (isWeekend(entry.year, entry.month, entry.day)) return COLOR_WEEKEND;
  return COLOR_WORKDAY;
}

/** Check if an entry has a non-Office-Closed event marker. */
export function hasEventMarker(
  entry: DayEntry,
  officeEventDateMap: Map<string, OfficeEventInfo>,
): boolean {
  const ev = officeEventDateMap.get(entry.dateKey);
  return !!ev && ev.event_type !== 'OFFICE_CLOSED';
}
