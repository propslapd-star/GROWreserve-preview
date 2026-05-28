/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  RefreshCw,
  Clock,
  MapPin,
  ExternalLink,
  ChevronDown,
  X,
  FileText,
  CalendarDays,
  AlertCircle,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarEvent, DaySchedule } from "./types";

// Standard formatting helpers (Local JST parts)
const formatJSTDateString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatJSTDayLabel = (date: Date) => {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const getDayOfWeekJP = (date: Date) => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[date.getDay()];
};

// Helper to sanitize and normalize Google Calendar descriptions for inline display
const cleanDescriptionForTile = (desc: string) => {
  if (!desc) return "";
  // Strip HTML tag markup if any
  const cleanMarkup = desc.replace(/<\/?[^>]+(>|$)/g, "");
  // Replace multiple linebreaks/whitespace with a single space
  return cleanMarkup.replace(/\s+/g, " ").trim();
};

// Color assignment based on event titles (Matching the user's specific region colors)
const getEventColorStyle = (title: string) => {
  const t = title.toLowerCase();
  
  if (t.includes("完了済み") || t.includes("完了")) {
    return {
      bg: "bg-[#3b82f6] text-white border-blue-600 hover:bg-[#2563eb]",
      border: "border-2 border-blue-700 font-bold",
      tag: "アポイント完了済み",
    };
  }
  if (t.includes("通常")) {
    return {
      bg: "bg-[#ffff33] text-black border-yellow-500 hover:bg-[#ffff1a]",
      border: "border-2 border-yellow-500 font-bold",
      tag: "通常アポイント",
    };
  }
  if (t.includes("日付指定") || t.includes("前日指定")) {
    return {
      bg: "bg-[#ff9900] text-black border-orange-500 hover:bg-[#ff8c00]",
      border: "border-2 border-orange-650 font-semibold",
      tag: "日付指定アポイント",
    };
  }
  if (t.includes("当日以降") || t.includes("以降")) {
    return {
      bg: "bg-white text-gray-800 border-gray-300 hover:bg-slate-50",
      border: "border-2 border-slate-300 font-semibold",
      tag: "当日以降アポイント",
    };
  }
  if (t.includes("不可") || t.includes("予約不可") || t.includes("eo")) {
    return {
      bg: "bg-[#ff0000] text-white border-red-700 hover:bg-[#ff1a1a]",
      border: "border border-red-800 font-bold",
      tag: "予約不可",
    };
  }
  if (t.includes("前枠") || t.includes("お客様対応") || t.includes("対応") || t.includes("枠")) {
    return {
      bg: "bg-[#610061] text-white border-purple-800 hover:bg-[#520052]",
      border: "border border-purple-900 font-semibold",
      tag: "前枠お客様対応分",
    };
  }

  // Fallback to White (当日以降アポイント) if no keywords met
  return {
    bg: "bg-white text-gray-800 border-gray-200 hover:bg-slate-50",
    border: "border border-gray-350 font-semibold",
    tag: "当日以降アポイント",
  };
};

// Client-side parser for ICS file (Google Calendar fallback)
const parseIcsDateClientSide = (dateStr: string, isUtcVal: boolean = false): Date => {
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (match) {
    const [, year, month, day, hour, min, sec, isUtc] = match;
    if (isUtc || isUtcVal) {
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      ));
    } else {
      const jstOffset = 9 * 60; // JST is UTC+9
      const utcTime = Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      ) - (jstOffset * 60 * 1000);
      return new Date(utcTime);
    }
  }

  // All day date check (YYYYMMDD)
  const allDayMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (allDayMatch) {
    const [, year, month, day] = allDayMatch;
    const jstOffset = 9 * 60;
    const utcTime = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      0, 0, 0
    ) - (jstOffset * 60 * 1000);
    return new Date(utcTime);
  }

  return new Date(dateStr);
};

const parseICSClientSide = (icsContent: string): CalendarEvent[] => {
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const rawEvents: any[] = [];
  let currentEvent: any = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const keyPart = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);
    const key = keyPart.split(";")[0].toUpperCase();

    if (key === "BEGIN" && value.toUpperCase() === "VEVENT") {
      currentEvent = {
        exdates: [] as string[],
      };
    } else if (key === "END" && value.toUpperCase() === "VEVENT") {
      if (currentEvent) {
        rawEvents.push(currentEvent);
        currentEvent = null;
      }
    } else if (currentEvent) {
      if (key === "SUMMARY") {
        currentEvent.summary = value.replace(/\\,/g, ",").replace(/\\;/g, ";");
      } else if (key === "DESCRIPTION") {
        currentEvent.description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
      } else if (key === "LOCATION") {
        currentEvent.location = value.replace(/\\,/g, ",").replace(/\\;/g, ";");
      } else if (key === "DTSTART") {
        currentEvent.dtstartRaw = value;
        currentEvent.dtstartParams = keyPart;
        currentEvent.isAllDay = !value.includes("T");
      } else if (key === "DTEND") {
        currentEvent.dtendRaw = value;
      } else if (key === "UID") {
        currentEvent.uid = value;
      } else if (key === "RRULE") {
        currentEvent.rrule = value;
      } else if (key === "EXDATE") {
        const dates = value.split(",");
        currentEvent.exdates.push(...dates);
      }
    }
  }

  const expandedEvents: CalendarEvent[] = [];
  const rangeStart = new Date("2026-05-01T00:00:00");
  const rangeEnd = new Date("2026-07-31T23:59:59");

  for (const ev of rawEvents) {
    if (!ev.dtstartRaw) continue;

    const summary = ev.summary || "(タイトルなし)";
    const description = ev.description || "";
    const location = ev.location || "";
    const uid = ev.uid || Math.random().toString();
    const isAllDay = !!ev.isAllDay;

    const startLocal = parseIcsDateClientSide(ev.dtstartRaw, ev.dtstartRaw.endsWith("Z"));
    const endLocal = ev.dtendRaw 
      ? parseIcsDateClientSide(ev.dtendRaw, ev.dtendRaw.endsWith("Z")) 
      : new Date(startLocal.getTime() + 60 * 60 * 1000);

    const dur = endLocal.getTime() - startLocal.getTime();

    const exdateSet = new Set<string>();
    if (ev.exdates) {
      for (const ex of ev.exdates) {
        const norm = ex.replace(/Z/, "").split("T")[0];
        exdateSet.add(norm);
        exdateSet.add(ex);
      }
    }

    if (!ev.rrule) {
      if (startLocal >= rangeStart && startLocal <= rangeEnd) {
        expandedEvents.push({
          id: uid,
          summary,
          description,
          location,
          start: startLocal.toISOString(),
          end: endLocal.toISOString(),
          isAllDay,
        });
      }
    } else {
      const rruleMap: Record<string, string> = {};
      const parts = ev.rrule.split(";");
      for (const p of parts) {
        const eq = p.indexOf("=");
        if (eq !== -1) {
          rruleMap[p.substring(0, eq).toUpperCase()] = p.substring(eq + 1).toUpperCase();
        }
      }

      const freq = rruleMap["FREQ"];
      const interval = parseInt(rruleMap["INTERVAL"] || "1", 10);
      const untilStr = rruleMap["UNTIL"];
      const count = rruleMap["COUNT"] ? parseInt(rruleMap["COUNT"], 10) : 999;
      const byday = rruleMap["BYDAY"];

      const untilDate = untilStr ? parseIcsDateClientSide(untilStr, true) : rangeEnd;

      let currentStart = new Date(startLocal.getTime());
      let instancesCount = 0;

      const dayMap: Record<string, number> = {
        SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
      };

      const targetDays = byday ? byday.split(",").map((d: string) => dayMap[d.trim()]) : [currentStart.getDay()];

      while (currentStart <= untilDate && currentStart <= rangeEnd && instancesCount < count) {
        const checkDay = currentStart.getDay();
        if (targetDays.includes(checkDay)) {
          const yyyy = currentStart.getFullYear();
          const mm = String(currentStart.getMonth() + 1).padStart(2, "0");
          const dd = String(currentStart.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}${mm}${dd}`;
          const dateStrWithTime = `${dateStr}T${String(currentStart.getHours()).padStart(2, "0")}${String(currentStart.getMinutes()).padStart(2, "0")}${String(currentStart.getSeconds()).padStart(2, "0")}`;

          if (!exdateSet.has(dateStr) && !exdateSet.has(dateStrWithTime)) {
            if (currentStart >= rangeStart && currentStart <= rangeEnd) {
              const currentEnd = new Date(currentStart.getTime() + dur);
              expandedEvents.push({
                id: `${uid}_${currentStart.getTime()}`,
                summary,
                description,
                location,
                start: currentStart.toISOString(),
                end: currentEnd.toISOString(),
                isAllDay,
              });
              instancesCount++;
            }
          }
        }

        if (freq === "DAILY") {
          currentStart.setDate(currentStart.getDate() + interval);
        } else if (freq === "WEEKLY") {
          if (byday) {
            currentStart.setDate(currentStart.getDate() + 1);
          } else {
            currentStart.setDate(currentStart.getDate() + 7 * interval);
          }
        } else if (freq === "MONTHLY") {
          currentStart.setMonth(currentStart.getMonth() + interval);
        } else {
          break;
        }

        if (currentStart.getTime() === startLocal.getTime() && freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") {
          break;
        }
      }
    }
  }

  return expandedEvents;
};

// High-quality fallback demo events so the application is instantly beautiful and interactable
const getDemoEvents = (): CalendarEvent[] => {
  return [
    {
      id: "demo_1",
      summary: "アポイント完了済み",
      description: "松原地区のアポイント対応が完了しました。\n顧客提示ステータス：完了済み",
      location: "松原市",
      start: "2026-05-28T10:00:00+09:00",
      end: "2026-05-28T11:30:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_2",
      summary: "通常アポイント",
      description: "定期のアポイント枠になります。\n担当者：山田",
      location: "東大阪市",
      start: "2026-05-28T13:00:00+09:00",
      end: "2026-05-28T15:00:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_3",
      summary: "日付指定アポイント",
      description: "事前に日付指定でいただいたアポイント予約枠です。",
      location: "八尾市",
      start: "2026-05-28T16:00:00+09:00",
      end: "2026-05-28T18:00:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_4",
      summary: "前枠お客様対応分",
      description: "前枠の調整・顧客対応スケジュールとなります。",
      location: "堺市",
      start: "2026-05-29T09:30:00+09:00",
      end: "2026-05-29T11:00:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_5",
      summary: "通常アポイント",
      description: "店舗メンテナンス・相談枠です。",
      location: "藤井寺市",
      start: "2026-05-29T14:00:00+09:00",
      end: "2026-05-29T16:30:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_6",
      summary: "予約不可",
      description: "システム調整および研修時間のため予約不可となっております。",
      location: "本部",
      start: "2026-05-29T18:00:00+09:00",
      end: "2026-05-29T20:00:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_7",
      summary: "前日指定アポイント",
      description: "前日にお電話にていただいた指定枠予約です。（日付指定、前日指定にマッチしてオレンジになります）",
      location: "松原市",
      start: "2026-05-30T11:00:00+09:00",
      end: "2026-05-30T12:30:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_8",
      summary: "アポイント完了済み",
      description: "当日対応分の完了アポイントです。",
      location: "羽曳野市",
      start: "2026-05-30T15:00:00+09:00",
      end: "2026-05-30T17:00:00+09:00",
      isAllDay: false
    },
    {
      id: "demo_9",
      summary: "当日以降アポイント",
      description: "当日以降に予定されている広域向けアポイント枠です。（白色判定）",
      location: "大阪市",
      start: "2026-05-31T10:00:00+09:00",
      end: "2026-05-31T14:00:00+09:00",
      isAllDay: false
    }
  ];
};

export default function App() {
  // Password protection state
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("app_authenticated") === "true";
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "wwwbiz-growcom") {
      setIsAuthenticated(true);
      localStorage.setItem("app_authenticated", "true");
      setPasswordError(null);
    } else {
      setPasswordError("パスワードが正しくありません。");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("app_authenticated");
    setPasswordInput("");
  };

  // Calendar Source Settings
  const [tableTitle, setTableTitle] = useState<string>("A");
  
  // App UI State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isDemoModeActive, setIsDemoModeActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Date Control (Today defaults to 2026-05-28!)
  const [anchorDate, setAnchorDate] = useState<Date>(new Date("2026-05-28T00:00:00"));
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<Date>(new Date("2026-05-01T00:00:00"));
  
  // Modal detail display
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Layout Options Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [customTableTitle, setCustomTableTitle] = useState<string>("予約空き状況 (予約状況 A)");

  // Scroll Refs
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const dayRowRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Fetch Google calendar events on mount & refresh
  const fetchEvents = async (force: boolean = false) => {
    setIsRefreshing(true);
    try {
      let fetchedEvents: CalendarEvent[] = [];
      let isDemo = false;
      let usedFallback = false;

      try {
        const response = await fetch(`/api/events${force ? "?force=true" : ""}`);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        // Read as text first to detect HTML responses (which cause JSON parse errors)
        const text = await response.text();
        if (text.trim().startsWith("<") || text.trim().startsWith("<!DOCTYPE")) {
          throw new Error("Received HTML instead of JSON. The server appears to be running on static files hosting.");
        }
        
        const data = JSON.parse(text);
        if (data.success) {
          fetchedEvents = data.events;
          isDemo = !!data.isDemo;
        } else {
          throw new Error(data.error || "カレンダーイベントの取得に失敗しました。");
        }
      } catch (backendError: any) {
        console.warn("Backend API not reachable or returned HTML. Trying direct Google Calendar fetch via multiple CORS-Proxy fallbacks...", backendError);
        usedFallback = true;
        
        try {
          const calendarId = "a79cd2a8ae67693a2b41f2d2ebd6cbd225f24c2573a95c420812d483ad07edc7@group.calendar.google.com";
          const googleIcsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics?nocache=${Date.now()}`;
          
          // List of reliable public CORS proxies to try sequentially
          const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(googleIcsUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(googleIcsUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(googleIcsUrl)}`
          ];

          let icsText = "";
          let proxySuccess = false;

          for (const proxyUrl of proxies) {
            try {
              console.log(`Trying public CORS proxy: ${proxyUrl}`);
              const proxyResponse = await fetch(proxyUrl);
              if (proxyResponse.ok) {
                const text = await proxyResponse.text();
                if (text && text.includes("BEGIN:VCALENDAR")) {
                  icsText = text;
                  proxySuccess = true;
                  console.log(`Successfully fetched calendar feed using proxy: ${proxyUrl.split("?")[0]}`);
                  break;
                }
              }
            } catch (e) {
              console.warn(`CORS proxy failed to respond: ${proxyUrl.split("?")[0]}`, e);
            }
          }

          if (!proxySuccess || !icsText) {
            throw new Error("All public CORS proxies returned empty data or failed connecting.");
          }
          
          const parsed = parseICSClientSide(icsText);
          parsed.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          
          if (parsed.length === 0) {
            isDemo = true;
            fetchedEvents = getDemoEvents();
          } else {
            fetchedEvents = parsed;
            isDemo = false;
          }
        } catch (directError: any) {
          console.error("Direct browser fetch and parsing also failed. Using offline demo data as ultimate safety fallback...", directError);
          isDemo = true;
          fetchedEvents = getDemoEvents();
        }
      }

      setEvents(fetchedEvents);
      setIsDemoModeActive(isDemo);
      setError(null);
    } catch (err: any) {
      console.error("Critical error inside fetchEvents flow:", err);
      setError(err.message || "予期しないエラーが発生しました。");
      setEvents(getDemoEvents());
      setIsDemoModeActive(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents(false);
  }, []);

  // Generate 62 days starting around the mock database anchor timeframe
  const generateDaysList = (): DaySchedule[] => {
    const start = new Date("2026-05-15T00:00:00");
    const list: DaySchedule[] = [];
    
    for (let i = 0; i < 62; i++) {
      const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = formatJSTDateString(current);
      const label = formatJSTDayLabel(current);
      const dayOfWeek = getDayOfWeekJP(current);
      
      list.push({
        date: current,
        dateStr,
        label,
        dayOfWeek,
        slots: []
      });
    }
    return list;
  };

  const daysList = generateDaysList();

  // Highlight selected date
  const selectedDateStr = formatJSTDateString(anchorDate);

  // Group fetched calendar events by YYYY-MM-DD
  const eventsByDay = events.reduce((acc, ev) => {
    // Parse start ISO to local calendar string
    const d = new Date(ev.start);
    const dayStr = formatJSTDateString(d);
    
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(ev);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Calculate left and width style matching 9:00 to 20:00 block
  const getPositionStyle = (startISO: string, endISO: string) => {
    const start = new Date(startISO);
    const end = new Date(endISO);

    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();

    const gridStart = 9 * 60; // 9:00
    const gridEnd = 20 * 60;  // 20:00
    const totalMin = gridEnd - gridStart;

    const leftMin = Math.max(gridStart, Math.min(gridEnd, startMin));
    const rightMin = Math.max(gridStart, Math.min(gridEnd, endMin));

    const leftPercent = ((leftMin - gridStart) / totalMin) * 100;
    const widthPercent = ((rightMin - leftMin) / totalMin) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(2, widthPercent)}%`, // At least 2% width simple visibility
    };
  };

  // Click date row scrolling handler
  const scrollToDate = (dateStr: string) => {
    const element = dayRowRefs.current[dateStr];
    if (element && scheduleContainerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Nav month inside mini calendar
  const handleCalendarNav = (direction: "prev" | "next") => {
    const nextMonth = new Date(selectedCalendarMonth.getTime());
    if (direction === "prev") {
      nextMonth.setMonth(nextMonth.getMonth() - 1);
    } else {
      nextMonth.setMonth(nextMonth.getMonth() + 1);
    }
    setSelectedCalendarMonth(nextMonth);
  };

  // Go to default Today
  const handleGoToToday = () => {
    const today = new Date("2026-05-28T00:00:00");
    setAnchorDate(today);
    setSelectedCalendarMonth(new Date("2026-05-01T00:00:00"));
    scrollToDate("2026-05-28");
  };

  // Jump page intervals (+- 7 days)
  const handlePageScroll = (direction: "prev" | "next") => {
    const offset = direction === "prev" ? -7 : 7;
    const newAnchor = new Date(anchorDate.getTime() + offset * 24 * 60 * 60 * 1000);
    setAnchorDate(newAnchor);
    scrollToDate(formatJSTDateString(newAnchor));
  };

  // Mini calendar calculation grid
  const getDaysInMonthGrid = () => {
    const year = selectedCalendarMonth.getFullYear();
    const month = selectedCalendarMonth.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const cells = [];
    
    // Aligns numbers with week column indexes
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="p-1 text-gray-200 text-center"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const isToday = day === 28 && month === 4 && year === 2026; // May 28, 2026 mock
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = formatJSTDateString(anchorDate) === dateStr;

      const dayOfWeek = dateObj.getDay();
      let fontColor = "text-gray-800";
      if (dayOfWeek === 0) fontColor = "text-red-500 font-bold";
      if (dayOfWeek === 6) fontColor = "text-blue-500 font-bold";

      cells.push(
        <button
          key={`day-${day}`}
          onClick={() => {
            const clickedDate = new Date(year, month, day);
            setAnchorDate(clickedDate);
            scrollToDate(dateStr);
          }}
          className={`text-center py-1 rounded-sm text-xs relative flex flex-col items-center justify-center cursor-pointer font-sans transition-all hover:bg-slate-100 ${fontColor}
            ${isSelected ? "ring-2 ring-indigo-600 font-extrabold" : ""}
            ${isToday ? "bg-amber-100 text-amber-950 font-extrabold" : ""}
          `}
        >
          <span>{day}</span>
          {isToday && (
            <span className="absolute bottom-[1px] text-[8px] scale-75 text-amber-700 leading-none font-bold">現時刻</span>
          )}
        </button>
      );
    }
    return cells;
  };

  // Format lovely date details range labels
  const formatEventTimesLabel = (startStr: string, endStr: string) => {
    const st = new Date(startStr);
    const et = new Date(endStr);
    
    const formatTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${getDayOfWeekJP(d)})`;
    };

    if (formatJSTDateString(st) === formatJSTDateString(et)) {
      return `${formatDate(st)} ${formatTime(st)} ~ ${formatTime(et)}`;
    }
    return `${formatDate(st)} ${formatTime(st)} ~ ${formatDate(et)} ${formatTime(et)}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" id="password_protection_wrapper">
        <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-8 shadow-xl relative overflow-hidden animate-fade-in" id="password_card">
          {/* Accent strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />
          
          <div className="flex flex-col items-center text-center select-none" id="password_card_header">
            <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm animate-pulse">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight" id="login_card_title">
              パスワード保護
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed" id="login_card_subtitle">
              「GROWカレンダー予約状況管理」の閲覧にはアクセス用パスワードの入力が必要です。
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4" id="password_form">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-wider select-none">
                アクセスパスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="パスワードを入力してください"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-10"
                  id="password_input_field"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  id="password_toggle_visibility_btn"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-red-600 font-bold mt-1.5 flex items-center gap-1.5" id="login_error_text">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold py-3 px-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              id="password_submit_btn"
            >
              ログインして閲覧する
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-100 pt-4" id="login_card_footer">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">
              BIZ-GROW © 2026
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 flex flex-col font-sans select-none overflow-hidden h-screen" id="main_layout_frame">
      
      {/* Top Banner Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-xs" id="navbar_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight" id="main_title_txt">
              カレンダー空き・予約状況スケジュール一覧
            </h1>
            <p className="text-xs text-gray-500 font-medium" id="sub_title_txt">
              Googleカレンダーから店舗予定・スケジュールを常にリアルタイムロード中
            </p>
          </div>
        </div>
        
        {/* Sync Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md transition-all font-semibold border border-slate-200 cursor-pointer"
            id="config_btn"
          >
            表示テキスト変更
          </button>

          <button 
            type="button"
            onClick={() => fetchEvents(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-md transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-75"
            id="sync_btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            リアルタイム同期
          </button>

          <button 
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 px-3.5 py-2 rounded-md transition-all font-semibold border border-rose-200/65 cursor-pointer"
            id="logout_lock_btn"
            title="ログアウトして画面をロックします"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Workspace Panel */}
      <div className="flex flex-1 overflow-hidden" id="workspace_viewport">
        
        {/* Left Control Column */}
        <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none" id="control_sidebar">
          


          {/* Monthly Mini Calendar Widget */}
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2">日付ジャンプ</span>
            <div className="border border-slate-200 rounded-lg p-3 bg-white" id="mini_calendar_container">
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => handleCalendarNav("prev")}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-800">
                  {selectedCalendarMonth.getFullYear()}年{selectedCalendarMonth.getMonth() + 1}月
                </span>
                <button 
                  onClick={() => handleCalendarNav("next")}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {/* Day Labels */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1">
                <span className="text-red-500">日</span>
                <span>月</span>
                <span>火</span>
                <span>水</span>
                <span>木</span>
                <span>金</span>
                <span className="text-blue-500">土</span>
              </div>
              
              {/* Day values */}
              <div className="grid grid-cols-7 gap-y-1">
                {getDaysInMonthGrid()}
              </div>
            </div>
          </div>

          {/* Quick jumps */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => handlePageScroll("prev")}
              className="w-full text-center text-xs py-2 px-3 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 font-semibold rounded-md transition-all cursor-pointer active:scale-98"
            >
              ← 前の7日間へ
            </button>
            <button
              onClick={handleGoToToday}
              className="w-full text-center text-xs py-2 px-3 border border-amber-200 text-amber-800 bg-amber-50/80 hover:bg-amber-100 font-bold rounded-md transition-all cursor-pointer active:scale-98"
            >
              本日 (5月28日)
            </button>
            <button
              onClick={() => handlePageScroll("next")}
              className="w-full text-center text-xs py-2 px-3 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 font-semibold rounded-md transition-all cursor-pointer active:scale-98"
            >
              次の7日間へ →
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Legends Color Coding representation matching user exact list */}
          <div className="bg-slate-50 hover:bg-slate-50/80 rounded-lg p-3 text-[11px] text-slate-600 flex flex-col gap-2.5 border border-slate-100" id="legend_panel">
            <h4 className="font-bold flex items-center gap-1 text-slate-700">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              予約予定の色分け色
            </h4>
            <div className="flex flex-col gap-2" id="legend_list">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#3b82f6] border border-blue-600 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">アポイント完了済み</span>
                  <p className="text-[9px] text-slate-400">「完了」のキーワードを含む予定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#ffff33] border border-yellow-500 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">通常アポイント</span>
                  <p className="text-[9px] text-slate-400">「通常」のキーワードを含む予定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#ff9900] border border-orange-500 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">日付指定アポイント</span>
                  <p className="text-[9px] text-slate-400">「日付指定」「前日指定」を含む予定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-gray-300 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">当日以降アポイント</span>
                  <p className="text-[9px] text-slate-400">「当日以降」のキーワードまたはそれ以外の予定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#ff0000] border border-red-700 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">予約不可</span>
                  <p className="text-[9px] text-slate-400">「不可」「予約不可」等を含む予定</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#610061] border border-purple-800 rounded-sm shadow-2xs" />
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">前枠お客様対応分</span>
                  <p className="text-[9px] text-slate-400">「前枠」「お客様対応」等を含む予定</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Dashboard Area */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden" id="timeline_main_dashboard">
          
          {/* Subtitle Label Metadata info */}
          <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center justify-between shrink-0" id="header_label_year">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-xs text-slate-500 font-mono tracking-wide">
                表示モード: ガントチャート・スケジュールタイムライン (9:00 - 20:00)
              </span>
            </div>
            <div className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-150 font-bold" id="ready_indicator">
              {isDemoModeActive ? "● デモプレビュー表示中 (0件ロード)" : `● 参照先Googleカレンダー同期済 (${events.length}件ロード完了)`}
            </div>
          </div>

          {isDemoModeActive && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs text-amber-800 flex items-start gap-2.5 shrink-0 animate-fade-in" id="demo_warning_banner">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5 text-amber-900">【ご確認ください：カレンダーが非公開または空のため、検証用デモデータが表示されています】</span>
                <p className="text-amber-700/90 leading-relaxed font-sans mb-1">
                  現在、参照先のGoogleカレンダー「GROW予約管理」から取得できた予定が0件です。カレンダーが完全に空であるか、またはGoogleカレンダーのアクセス権限設定で<strong>「一般公開する」かつ「すべての予定の詳細を表示」</strong>になっていない可能性があります（「予定の時間枠のみ（詳細を非表示）」の場合、予定の件数が0件として出力されます）。
                </p>
                <p className="text-amber-700/80 font-sans">
                  ※ Google側の設定を「すべての予定の詳細を表示」に変更後、画面右上の<strong>「リアルタイム同期」</strong>をクリックすると最新状態が即時反映されます。現在は予定の分類や配色スタイルが機能する様子をご確認いただけるよう、プレビュー用デモデータを表示しています。
                </p>
              </div>
            </div>
          )}

          {/* Hourly scale header labels */}
          <div className="bg-slate-50 grid grid-cols-[140px_1fr] border-b border-slate-200 shrink-0 text-xs text-slate-600 font-bold font-mono tracking-wider items-center h-10 select-none" id="hourly_scale_header">
            <div className="px-4 border-r border-slate-200 h-full flex items-center" id="lbl_col_date">日付</div>
            <div className="grid grid-cols-11 h-full pl-0.5" id="lbl_col_hours">
              {["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"].map((hour, index) => (
                <div 
                  key={`scale-hour-${hour}`} 
                  className={`px-1 h-full flex items-center border-r border-slate-200/60 justify-start pl-[4px] relative ${index === 10 ? "border-r-0" : ""}`}
                >
                  <span className="inline-block text-[11px] font-bold text-slate-500 font-mono">
                    {hour}:00
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Grid values */}
          <div 
            ref={scheduleContainerRef}
            className="flex-1 overflow-y-auto relative divide-y divide-slate-100 no-scrollbar select-none"
            id="gantt_rows_scroller"
          >
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80" id="spinner_layer">
                <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-sm text-slate-600 font-bold font-sans">Googleカレンダー読み込み中...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center" id="error_layer">
                <div className="inline-flex flex-col items-center p-6 bg-red-50 text-red-700 rounded-lg border border-red-200 max-w-sm">
                  <span className="font-extrabold text-base mb-1">カレンダー読み込み失敗</span>
                  <p className="text-xs text-red-600/90 mb-4">{error}</p>
                  <button 
                    onClick={() => fetchEvents(true)}
                    className="bg-red-600 text-white rounded-md px-4 py-2 hover:bg-red-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    リロード
                  </button>
                </div>
              </div>
            ) : (
              daysList.map((day) => {
                const dayEvents = eventsByDay[day.dateStr] || [];
                const isSelected = selectedDateStr === day.dateStr;

                // Color weekend headers gracefully
                let headerClass = "bg-white";
                let textClass = "text-slate-800 font-extrabold";
                let badgeClass = "bg-slate-100 text-slate-600";

                if (day.dayOfWeek === "土") {
                  headerClass = "bg-indigo-50/30";
                  textClass = "text-blue-700 font-extrabold";
                  badgeClass = "bg-blue-100/70 text-blue-800";
                } else if (day.dayOfWeek === "日") {
                  headerClass = "bg-rose-50/30";
                  textClass = "text-red-700 font-extrabold";
                  badgeClass = "bg-rose-100/70 text-red-800";
                }

                return (
                  <div 
                    key={day.dateStr}
                    ref={(el) => { dayRowRefs.current[day.dateStr] = el; }}
                    className={`grid grid-cols-[140px_1fr] relative min-h-[3.75rem] transition-colors ${isSelected ? "bg-indigo-50/30 ring-1 ring-inset ring-indigo-200" : ""}`}
                    id={`day-row-${day.dateStr}`}
                  >
                    {/* Day label metadata representation column */}
                    <div 
                      className={`px-3 py-2.5 flex flex-col justify-center items-start border-r border-slate-200 ${headerClass}`}
                      id={`day-header-${day.dateStr}`}
                    >
                      <span className={`text-[13px] tracking-tight ${textClass}`}>
                        {day.label}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm tracking-wide mt-1 inline-block ${badgeClass}`}>
                        {day.dayOfWeek}曜日
                      </span>
                    </div>

                    {/* Timeline Cell */}
                    <div className="relative h-full w-full select-none" id={`timeline-content-${day.dateStr}`}>
                      
                      {/* Grid underlying markers */}
                      <div className="absolute inset-0 grid grid-cols-11 pointer-events-none h-full pl-0.5">
                        {Array.from({ length: 11 }).map((_, index) => (
                          <div 
                            key={`bg-hour-bar-${day.dateStr}-${index}`} 
                            className={`border-r border-slate-100 h-full ${index === 10 ? "border-r-0" : ""}`} 
                          />
                        ))}
                      </div>

                      {/* Timeline Events positioned absolutely */}
                      <div className="absolute inset-0 h-full w-full flex items-center pr-2 pl-0.5" id={`events-overlay-${day.dateStr}`}>
                        
                        {dayEvents.length === 0 ? (
                          <div className="text-[10px] text-slate-300 font-medium pl-4 py-2 font-mono whitespace-nowrap italic pointer-events-none select-none">
                            （予定がありません。空き時間となっております。）
                          </div>
                        ) : (
                          dayEvents.map((ev) => {
                            const pos = getPositionStyle(ev.start, ev.end);
                            // Display the calendar title (summary) on the tile as requested
                            const eventLabel = ev.summary;
                            const styleConfig = getEventColorStyle(ev.description && ev.description.trim() ? `${ev.summary} ${ev.description}` : ev.summary);

                            return (
                              <button
                                key={`event-pill-${ev.id}`}
                                style={pos}
                                onClick={() => setSelectedEvent(ev)}
                                className={`absolute h-[80%] rounded-md flex items-center justify-between px-3 text-left overflow-hidden select-none cursor-pointer transition-all active:scale-98 border shadow-xs ${styleConfig.bg} ${styleConfig.border}`}
                                title={ev.description && ev.description.trim() ? `${ev.summary}: ${ev.description}` : `${ev.summary}`}
                              >
                                <span className="font-sans text-[11px] font-black tracking-tight truncate mr-1">
                                  {eventLabel}
                                </span>
                                <span className="text-[8px] font-bold scale-90 px-1 rounded-sm bg-black/5 shrink-0 block">
                                  {styleConfig.tag}
                                </span>
                              </button>
                            );
                          })
                        )}

                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* EVENT DETAILED INSPECTOR DIALOG MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" id="inspect_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200"
              id="inspect_modal"
            >
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between" id="inspect_header">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-base">予約済スケジュール詳細</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4 font-sans text-xs" id="inspect_body">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">予定名（店舗ステータス）</span>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-black text-slate-800 leading-snug">
                      {selectedEvent.summary}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      日時 (時間枠)
                    </span>
                    <p className="font-bold text-slate-700 mt-1 whitespace-nowrap">
                      {formatEventTimesLabel(selectedEvent.start, selectedEvent.end)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                      対象エリア (場所)
                    </span>
                    <p className="font-bold text-slate-700 mt-1">
                      {selectedEvent.location || "（詳細登録なし）"}
                    </p>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400">お問合せ・補足メモ</span>
                    <div className="bg-slate-50 p-3.5 rounded-lg text-slate-600 font-medium whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto select-text border border-slate-100">
                      {selectedEvent.description}
                    </div>
                  </div>
                )}

                <div className="mt-2 text-[11px] text-slate-400 leading-normal flex items-start gap-1.5 pt-2 border-t border-slate-100">
                  <Info className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                  <p>
                    この予定は、Googleカレンダーと連動しているため、アプリ内で直接変更できません。予約時間の変更やキャンセルが必要な場合は、店頭スタッフまでご連絡ください。
                  </p>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold hover:shadow-xs rounded-lg transition-all cursor-pointer text-xs"
                  >
                    詳細ウィンドウを開じる
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEXT TITLE SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" id="settings_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200"
              id="settings_modal_box"
            >
              <div className="bg-slate-900 text-white p-4 font-bold flex items-center justify-between">
                <span>表示設定変更</span>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4 text-xs" id="settings_body">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">カレンダー表示名称</label>
                  <input
                    type="text"
                    value={customTableTitle}
                    onChange={(e) => setCustomTableTitle(e.target.value)}
                    placeholder="例: スケジュール表 A"
                    className="w-full text-sm border border-slate-300 rounded-md py-2 px-3 focus:outline-none focus:border-indigo-600 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    顧客にプレゼンテーションする際の予約表タイトルを変更できます。
                  </p>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold rounded-md cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-md cursor-pointer"
                  >
                    設定を保存する
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
