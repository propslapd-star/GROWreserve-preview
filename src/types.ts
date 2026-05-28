export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string; // ISO String
  end: string; // ISO String
  isAllDay: boolean;
}

export interface BookingSlot {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "10:00"
  endTime: string; // "13:00"
  status: "available" | "booked" | "unavailable";
  event?: CalendarEvent;
}

export interface DaySchedule {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  label: string; // "5月28日"
  dayOfWeek: string; // "木"
  slots: BookingSlot[];
}
