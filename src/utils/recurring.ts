import { CalendarEvent } from "../types";

export function parseDateString(dateStr: string): Date {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isEventOnDate(event: CalendarEvent, targetDateStr: string): boolean {
  if (event.date === targetDateStr) return true;
  if (!event.repeat || event.repeat === "none") return false;

  const eventDate = parseDateString(event.date);
  const targetDate = parseDateString(targetDateStr);

  // If target date is before the start of the event, it cannot occur.
  if (targetDate.getTime() < eventDate.getTime()) {
    return false;
  }

  if (event.repeat === "daily") {
    return true;
  }

  if (event.repeat === "weekly") {
    return eventDate.getDay() === targetDate.getDay();
  }

  if (event.repeat === "monthly") {
    return eventDate.getDate() === targetDate.getDate();
  }

  return false;
}

/**
 * Expands a list of events into individual virtual occurrences within a specific range of date strings.
 */
export function expandEventsForRange(
  events: CalendarEvent[],
  activeDateStrings: string[]
): { event: CalendarEvent; occurrenceDate: string }[] {
  const occurrences: { event: CalendarEvent; occurrenceDate: string }[] = [];

  events.forEach(event => {
    activeDateStrings.forEach(dateStr => {
      if (isEventOnDate(event, dateStr)) {
        occurrences.push({
          event,
          occurrenceDate: dateStr
        });
      }
    });
  });

  return occurrences;
}
