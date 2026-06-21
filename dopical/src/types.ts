export type CalendarTag = "work" | "fitness" | "sleep" | "faith" | "personal" | "socials" | "holiday" | "education" | "finance";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  description: string;
  tag: CalendarTag;
  repeat?: "none" | "daily" | "weekly" | "monthly";
}

export interface DayInfo {
  dateString: string; // "YYYY-MM-DD"
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}
