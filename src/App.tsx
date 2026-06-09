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
  EyeOff,
  Menu
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

const JAPANESE_HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-01-01": "元日",
  "2025-01-13": "成人の日",
  "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日",
  "2025-02-24": "振替休日",
  "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日",
  "2025-05-03": "憲法記念日",
  "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日",
  "2025-05-06": "振替休日",
  "2025-07-21": "海の日",
  "2025-08-11": "山の日",
  "2025-09-15": "敬老の日",
  "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日",
  "2025-11-03": "文化の日",
  "2025-11-23": "勤労感謝の日",
  "2025-11-24": "振替休日",

  // 2026
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",

  // 2027
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-03-22": "振替休日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日",
};

const getJapaneseHoliday = (date: Date): string | null => {
  const dateStr = formatJSTDateString(date);
  if (JAPANESE_HOLIDAYS[dateStr]) {
    return JAPANESE_HOLIDAYS[dateStr];
  }
  
  // Basic calculation fallback for fixed days
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) return "元日";
  if (month === 2 && day === 11) return "建国記念の日";
  if (month === 2 && day === 23) return "天皇誕生日";
  if (month === 4 && day === 29) return "昭和の日";
  if (month === 5 && day === 3) return "憲法記念日";
  if (month === 5 && day === 4) return "みどりの日";
  if (month === 5 && day === 5) return "こどもの日";
  if (month === 8 && day === 11) return "山の日";
  if (month === 11 && day === 3) return "文化の日";
  if (month === 11 && day === 23) return "勤労感謝の日";
  
  return null;
};

const formatJSTTimeLabel = (isoString: string) => {
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch (e) {
    return "";
  }
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
const getEventColorStyle = (title: string, startISO?: string) => {
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
    const diffDays = startISO ? (() => {
      try {
        const dDate = new Date(startISO);
        dDate.setHours(0, 0, 0, 0);
        let todayRef = new Date();
        if (todayRef.getFullYear() !== 2026) {
          todayRef = new Date("2026-05-29T00:00:00");
        }
        todayRef.setHours(0, 0, 0, 0);
        const diffTime = dDate.getTime() - todayRef.getTime();
        return Math.round(diffTime / (1000 * 60 * 60 * 24));
      } catch (e) {
        return 0;
      }
    })() : 0;

    if (diffDays <= 4) {
      return {
        bg: "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300 cursor-not-allowed",
        border: "border border-slate-400 font-medium",
        tag: "予約不可",
      };
    } else {
      return {
        bg: "bg-[#ff0000] text-white border-red-700 hover:bg-[#ff1a1a]",
        border: "border border-red-800 font-bold",
        tag: "予約不可",
      };
    }
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
  
  // Date Control (Today!)
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  // Modal detail display
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Layout Options Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [customTableTitle, setCustomTableTitle] = useState<string>("予約空き状況 (予約状況 A)");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Scroll Refs
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const dayRowRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Zoom status
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem("gantt_zoom_level");
    if (saved) {
      const num = parseFloat(saved);
      if (!isNaN(num) && num >= 0.5 && num <= 2.0) return num;
    }
    return 1.0;
  });

  const zoomLevelRef = useRef<number>(zoomLevel);
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const zoomContainerRef = useRef<HTMLDivElement>(null);

  const updateZoomLevel = (newVal: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Math.round(newVal * 100) / 100));
    setZoomLevel(clamped);
    localStorage.setItem("gantt_zoom_level", clamped.toString());
  };

  useEffect(() => {
    const container = zoomContainerRef.current;
    if (!container) return;

    let initialDistance: number | null = null;
    let initialZoom = 1.0;

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
        initialZoom = zoomLevelRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scaleFactor = currentDistance / initialDistance;
        const targetZoom = initialZoom * scaleFactor;
        const clampedZoom = Math.max(0.6, Math.min(2.0, Math.round(targetZoom * 40) / 40));
        setZoomLevel(clampedZoom);
        localStorage.setItem("gantt_zoom_level", clampedZoom.toString());
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const direction = e.deltaY < 0 ? 1 : -1;
        const speed = 0.05;
        const targetZoom = zoomLevelRef.current + direction * speed;
        const clamped = Math.max(0.6, Math.min(2.0, Math.round(targetZoom * 40) / 40));
        setZoomLevel(clamped);
        localStorage.setItem("gantt_zoom_level", clamped.toString());
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

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

  const hasInitialScrolled = useRef(false);

  useEffect(() => {
    fetchEvents(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !hasInitialScrolled.current) {
      let attempts = 0;
      const today = new Date();
      const todayStr = formatJSTDateString(today);

      const tryScroll = () => {
        const element = dayRowRefs.current[todayStr];
        if (element && scheduleContainerRef.current) {
          scrollToDate(todayStr, "start");
          hasInitialScrolled.current = true;
        } else if (attempts < 15) {
          attempts++;
          setTimeout(tryScroll, 100);
        }
      };

      setTimeout(tryScroll, 150);
    }
  }, [isLoading]);

  // Generate 62 days starting around the mock database anchor timeframe
  const generateDaysList = (): DaySchedule[] => {
    const start = new Date("2026-05-15T00:00:00");
    const list: DaySchedule[] = [];
    
    for (let i = 0; i < 62; i++) {
      const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = formatJSTDateString(current);
      const label = formatJSTDayLabel(current);
      const dayOfWeek = getDayOfWeekJP(current);
      const holidayName = getJapaneseHoliday(current) || undefined;
      
      list.push({
        date: current,
        dateStr,
        label,
        dayOfWeek,
        holidayName,
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

  // Helper to fill open gaps on a specific day with "予約不可" events
  const fillEmptySlotsWithUnavailable = (dayDate: Date, existingEvents: CalendarEvent[]): CalendarEvent[] => {
    const year = dayDate.getFullYear();
    const month = dayDate.getMonth();
    const date = dayDate.getDate();

    // Define work hours limits as Dates (10:00 to 19:00)
    const workStart = new Date(year, month, date, 10, 0, 0);
    const workEnd = new Date(year, month, date, 19, 0, 0);

    const intervals: { start: Date; end: Date }[] = [];
    
    for (const ev of existingEvents) {
      if (ev.isAllDay) {
        return [];
      }
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      
      const clampStart = s < workStart ? workStart : (s > workEnd ? workEnd : s);
      const clampEnd = e < workStart ? workStart : (e > workEnd ? workEnd : e);

      if (clampStart < clampEnd) {
        intervals.push({ start: clampStart, end: clampEnd });
      }
    }

    intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: { start: Date; end: Date }[] = [];
    for (const item of intervals) {
      if (merged.length === 0) {
        merged.push({ ...item });
      } else {
        const last = merged[merged.length - 1];
        if (item.start <= last.end) {
          last.end = new Date(Math.max(last.end.getTime(), item.end.getTime()));
        } else {
          merged.push({ ...item });
        }
      }
    }

    const unavailableEvents: CalendarEvent[] = [];
    let currentPtr = workStart;

    for (const interval of merged) {
      if (interval.start > currentPtr) {
        if (interval.start.getTime() - currentPtr.getTime() > 0) {
          unavailableEvents.push({
            id: `unavail_gap_${dayDate.getTime()}_${currentPtr.getTime()}`,
            summary: "予約不可",
            description: "システム調整および直前の調整時間のため予約不可となっております。",
            location: "非公開",
            start: currentPtr.toISOString(),
            end: interval.start.toISOString(),
            isAllDay: false
          });
        }
      }
      if (interval.end > currentPtr) {
        currentPtr = interval.end;
      }
    }

    if (currentPtr < workEnd) {
      if (workEnd.getTime() - currentPtr.getTime() > 0) {
        unavailableEvents.push({
          id: `unavail_gap_${dayDate.getTime()}_${currentPtr.getTime()}`,
          summary: "予約不可",
          description: "システム調整および直前の調整時間のため予約不可となっております。",
          location: "非公開",
          start: currentPtr.toISOString(),
          end: workEnd.toISOString(),
          isAllDay: false
        });
      }
    }

    return unavailableEvents;
  };

  // Calculate left and width style matching 9:00 to 20:00 block
  const getPositionStyle = (startISO: string, endISO: string) => {
    const start = new Date(startISO);
    const end = new Date(endISO);

    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();

    const gridStart = 10 * 60; // 10:00
    const gridEnd = 19 * 60;  // 19:00
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
  const scrollToDate = (dateStr: string, _block: ScrollIntoViewOptions["block"] = "start") => {
    const element = dayRowRefs.current[dateStr];
    const container = scheduleContainerRef.current;
    if (element && container) {
      let topVal = 0;
      let cur: HTMLElement | null = element;
      while (cur && cur !== container) {
        topVal += cur.offsetTop;
        cur = cur.offsetParent as HTMLElement | null;
      }
      container.scrollTo({
        top: topVal,
        behavior: "smooth"
      });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setAnchorDate(today);
    setSelectedCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    scrollToDate(formatJSTDateString(today));
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
      const realToday = new Date();
      const isToday = day === realToday.getDate() && month === realToday.getMonth() && year === realToday.getFullYear();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = formatJSTDateString(anchorDate) === dateStr;

      const dayOfWeek = dateObj.getDay();
      const holidayName = getJapaneseHoliday(dateObj);
      const isHoliday = !!holidayName;

      let fontColor = "text-gray-800";
      if (dayOfWeek === 0 || isHoliday) fontColor = "text-red-500 font-bold";
      else if (dayOfWeek === 6) fontColor = "text-blue-500 font-bold";

      cells.push(
        <button
          key={`day-${day}`}
          onClick={() => {
            const clickedDate = new Date(year, month, day);
            setAnchorDate(clickedDate);
            scrollToDate(dateStr);
            setIsSidebarOpen(false);
          }}
          title={holidayName || undefined}
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
      <header className="bg-white border-b border-gray-200 px-3 py-2.5 sm:px-4 md:px-6 md:py-4 flex items-center justify-between shrink-0 shadow-xs gap-2 select-none sticky top-0 z-30" id="navbar_header">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer flex items-center justify-center transition-all border border-slate-200 shrink-0"
            title="メニュー・カレンダーを表示 / 非表示"
            id="sidebar_toggle_btn"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap truncate" id="main_title_txt">
              予約スケジュール
            </h1>
          </div>
        </div>
        
        {/* Sync Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => {
              fetchEvents(true).then(() => {
                setTimeout(() => {
                  const today = new Date();
                  scrollToDate(formatJSTDateString(today), "start");
                }, 400);
              });
            }}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-[10px] sm:text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 sm:px-3 sm:py-2 md:px-3.5 md:py-2 rounded-md transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-75 whitespace-nowrap"
            id="sync_btn"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden xs:inline">リアルタイム</span>同期
          </button>

          <button 
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center text-[10px] sm:text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-3.5 md:py-2 rounded-md transition-all font-semibold border border-rose-200/65 cursor-pointer whitespace-nowrap"
            id="logout_lock_btn"
            title="ログアウトして画面をロックします"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Workspace Panel */}
      <div className="flex flex-1 overflow-hidden relative" id="workspace_viewport">
        
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-35 bg-slate-950/40 backdrop-blur-xs lg:hidden transition-all duration-200" 
            onClick={() => setIsSidebarOpen(false)} 
            id="sidebar_overlay_backdrop"
          />
        )}

        {/* Left Control Column */}
        <aside 
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`} 
          id="control_sidebar"
        >
          
          {/* Mobile Close Button Row */}
          <div className="flex items-center justify-between lg:hidden border-b border-slate-100 pb-2 mb-1 shrink-0">
            <span className="text-xs font-bold text-slate-500">メニュー・表示設定</span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-slate-100 rounded cursor-pointer"
              id="sidebar_close_btn"
            >
              <X className="w-4.5 h-4.5 text-slate-500" />
            </button>
          </div>
          


          {/* Monthly Mini Calendar Widget */}
          <div>
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
              本日 ({new Date().getMonth() + 1}月{new Date().getDate()}日)
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
                <div className="flex gap-1 shrink-0">
                  <div className="w-3 h-3 bg-slate-200 border border-slate-400 rounded-xs shadow-2xs" />
                  <div className="w-3 h-3 bg-[#ff0000] border border-red-750 rounded-xs shadow-2xs" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block leading-tight">予約不可</span>
                  <p className="text-[9px] text-slate-400">「不可」「予約不可」等（3日以内・当日以降は灰色、4日以降は赤色で表示）</p>
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
          <div className="bg-slate-100 px-3 py-1.5 sm:px-6 sm:py-2 border-b border-slate-200 flex items-center justify-between shrink-0 gap-2 select-none sticky top-0 z-20" id="header_label_year">
            <div className="flex items-center gap-2 font-semibold min-w-0">
              <span className="text-[10px] sm:text-xs text-slate-500 font-mono tracking-wide truncate">
                <span className="hidden sm:inline">表示モード: </span>ガントチャート<span className="hidden md:inline">・スケジュールタイムライン</span> (10:00 - 19:00)
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Zoom Control Panel */}
              <div className="flex items-center bg-slate-200/50 p-0.5 rounded-md border border-slate-300/40 text-[9px] sm:text-xs select-none shadow-3xs" id="zoom_action_controller">
                <button
                  type="button"
                  onClick={() => updateZoomLevel(zoomLevel - 0.1)}
                  className="px-1.5 py-0.5 font-extrabold text-slate-700 hover:text-indigo-600 rounded-sm hover:bg-white active:scale-95 transition-all outline-hidden cursor-pointer"
                  title="縮小"
                >
                  ー
                </button>
                <button
                  type="button"
                  onClick={() => updateZoomLevel(1.0)}
                  className="px-1.5 py-0.5 font-bold font-mono text-slate-600 hover:text-indigo-600 rounded-sm hover:bg-white active:scale-95 transition-all text-[8px] sm:text-[10px] outline-hidden cursor-pointer"
                  title="ズームをリセットして100%にする"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => updateZoomLevel(zoomLevel + 0.1)}
                  className="px-1.5 py-0.5 font-extrabold text-slate-700 hover:text-indigo-600 rounded-sm hover:bg-white active:scale-95 transition-all outline-hidden cursor-pointer"
                  title="拡大"
                >
                  ＋
                </button>
              </div>

              <div className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full border border-indigo-150 font-bold shrink-0 truncate animate-fade-in" id="ready_indicator">
                {isDemoModeActive ? (
                  <>
                    <span className="hidden sm:inline">● デモプレビュー表示中 (0件ロード)</span>
                    <span className="sm:hidden">● デモ表示中</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">● 参照先カレンダー同期済 ({events.length}件ロード完了)</span>
                    <span className="sm:hidden">● 同期済 ({events.length}件)</span>
                  </>
                )}
              </div>
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

          {/* Gantt Chart Horizontal Scroll Container */}
          <div ref={zoomContainerRef} className="w-full flex-1 flex flex-col overflow-x-auto overflow-y-hidden touch-pan-x" id="gantt_chart_x_scroller">
            <div style={{ zoom: zoomLevel }} className="min-w-0 md:min-w-[760px] flex-1 flex flex-col h-full w-full origin-top-left" id="gantt_chart_inner_width_container">

              {/* Hourly scale header labels */}
              <div className="bg-slate-50 grid grid-cols-[70px_1fr] sm:grid-cols-[85px_1fr] md:grid-cols-[140px_1fr] border-b border-slate-300 shrink-0 text-xs text-slate-600 font-bold font-mono tracking-wider items-center h-10 select-none sticky top-0 z-10" id="hourly_scale_header">
            <div className="px-1.5 sm:px-3 md:px-4 border-r border-slate-300 h-full flex items-center text-[10px] md:text-xs" id="lbl_col_date">日付</div>
            <div className="grid grid-cols-9 h-full pl-0.5" id="lbl_col_hours">
              {["10", "11", "12", "13", "14", "15", "16", "17", "18"].map((hour, index) => (
                <div 
                  key={`scale-hour-${hour}`} 
                  className={`px-0.5 sm:px-1 h-full flex items-center border-r border-slate-300 justify-center sm:justify-start sm:pl-[4px] relative ${index === 8 ? "border-r-0" : ""}`}
                >
                  <span className="inline-block text-[8.5px] sm:text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap tracking-tighter leading-none">
                    {hour}:00
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Grid values */}
          <div 
            ref={scheduleContainerRef}
            className="flex-1 overflow-y-auto relative divide-y divide-slate-300 no-scrollbar select-none"
            id="gantt_rows_scroller"
          >
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80" id="spinner_layer">
                <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-sm text-slate-600 font-bold font-sans">カレンダーデータ参照中...</p>
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
                let dayEvents = eventsByDay[day.dateStr] || [];
                
                // Block active/empty times for days within 3 days from today (including today, and onward)
                const dDate = new Date(day.date);
                dDate.setHours(0, 0, 0, 0);

                let todayRef = new Date();
                if (todayRef.getFullYear() !== 2026) {
                  todayRef = new Date("2026-05-29T00:00:00");
                }
                todayRef.setHours(0, 0, 0, 0);

                const diffTime = dDate.getTime() - todayRef.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 3) {
                  const gaps = fillEmptySlotsWithUnavailable(day.date, dayEvents);
                  dayEvents = [...dayEvents, ...gaps];
                  dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
                }

                const isSelected = selectedDateStr === day.dateStr;
                const isRealToday = day.dateStr === formatJSTDateString(new Date());

                // Color weekend headers gracefully
                let headerClass = "bg-white";
                let textClass = "text-slate-800 font-extrabold";
                let badgeClass = "bg-slate-100 text-slate-600";

                if (isRealToday) {
                  headerClass = "bg-slate-300";
                  textClass = "text-slate-900 font-extrabold";
                  badgeClass = "bg-slate-500 text-white";
                } else if (day.holidayName) {
                  headerClass = "bg-rose-50/30";
                  textClass = "text-red-700 font-extrabold";
                  badgeClass = "bg-rose-100/70 text-red-800";
                } else if (day.dayOfWeek === "土") {
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
                    className={`grid grid-cols-[70px_1fr] sm:grid-cols-[85px_1fr] md:grid-cols-[140px_1fr] relative min-h-[2.5rem] lg:min-h-[3rem] transition-colors ${isSelected ? "bg-indigo-50/30 ring-1 ring-inset ring-indigo-200" : ""}`}
                    id={`day-row-${day.dateStr}`}
                  >
                    {/* Day label metadata representation column */}
                    <div 
                      className={`px-1 sm:px-2 py-1 flex flex-col justify-center border-r border-slate-300 h-full gap-0.5 md:flex-row md:items-center md:justify-between md:px-2.5 ${headerClass}`}
                      id={`day-header-${day.dateStr}`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 justify-center md:justify-start select-none">
                        <span className={`text-[10px] sm:text-xs font-black tracking-tighter sm:tracking-tight shrink-0 ${textClass}`}>
                          <span className="md:hidden">{day.label.replace("月", "/").replace("日", "")}</span>
                          <span className="hidden md:inline">{day.label}</span>
                        </span>
                        <span className={`text-[8.5px] sm:text-[9.5px] font-bold px-0.5 py-0.2 md:px-1 md:py-0.5 rounded-xs tracking-tighter sm:tracking-wider shrink-0 ${badgeClass}`}>
                          {day.dayOfWeek}
                        </span>
                      </div>
                      {day.holidayName && (
                        <div className="flex justify-center select-none shrink-0" title={day.holidayName}>
                          <span className="text-[7.5px] md:text-[8px] font-extrabold px-0.5 py-[0.5px] md:px-1 md:py-0.5 rounded-xs tracking-tighter bg-rose-100 text-red-700 border border-rose-200 text-center truncate max-w-[28px] md:max-w-[52px]">
                            <span className="md:hidden">祝</span>
                            <span className="hidden md:inline">{day.holidayName}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline Cell */}
                    <div className="relative h-full w-full select-none" id={`timeline-content-${day.dateStr}`}>
                      
                      {/* Grid underlying markers */}
                      <div className="absolute inset-0 grid grid-cols-9 pointer-events-none h-full pl-0.5">
                        {Array.from({ length: 9 }).map((_, index) => (
                          <div 
                            key={`bg-hour-bar-${day.dateStr}-${index}`} 
                            className={`border-r border-slate-200 h-full ${index === 8 ? "border-r-0" : ""}`} 
                          />
                        ))}
                      </div>

                      {/* Timeline Events positioned absolutely */}
                      <div className="absolute inset-0 h-full w-full flex items-center pr-2 pl-0.5" id={`events-overlay-${day.dateStr}`}>
                        
                        {dayEvents.length === 0 ? (
                          diffDays <= 0 ? (
                            <div className="text-[10px] text-slate-400 font-medium pl-4 h-full flex items-center font-mono whitespace-nowrap italic pointer-events-none select-none">
                              （予約不可）
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-300 font-medium pl-4 h-full flex items-center font-mono whitespace-nowrap italic pointer-events-none select-none">
                              （訪問予定なし・予約可能）
                            </div>
                          )
                        ) : (
                          dayEvents.map((ev) => {
                            const pos = getPositionStyle(ev.start, ev.end);
                            // Display the calendar title (summary) on the tile as requested
                            const eventLabel = ev.summary;
                            const styleConfig = getEventColorStyle(
                              ev.description && ev.description.trim() ? `${ev.summary} ${ev.description}` : ev.summary,
                              ev.start
                            );

                            // Calculate duration in minutes to handle short visual labels gracefully
                            const startObj = new Date(ev.start);
                            const endObj = new Date(ev.end);
                            const durationMin = (endObj.getTime() - startObj.getTime()) / 60000;
                            const showFullTime = durationMin >= 60;
                            const showShortTime = durationMin >= 30;

                            return (
                              <button
                                key={`event-pill-${ev.id}`}
                                style={pos}
                                onClick={() => setSelectedEvent(ev)}
                                className={`absolute h-[85%] rounded-md flex flex-row items-center px-1.5 py-0 text-left overflow-hidden select-none cursor-pointer transition-all active:scale-98 border shadow-2xs ${styleConfig.bg} ${styleConfig.border}`}
                                title={ev.description && ev.description.trim() ? `${ev.summary}: ${ev.description}` : `${ev.summary}`}
                              >
                                {(showFullTime || showShortTime) && (
                                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 border-r border-black/10 pr-1 sm:pr-1.5 mr-1 sm:mr-1.5 h-3.5 select-none whitespace-nowrap">
                                    <span className="text-[7.5px] sm:text-[8.5px] font-bold opacity-90 font-mono tracking-tighter whitespace-nowrap">
                                      {showFullTime ? (
                                        `${formatJSTTimeLabel(ev.start)}-${formatJSTTimeLabel(ev.end)}`
                                      ) : (
                                        `${formatJSTTimeLabel(ev.start)}`
                                      )}
                                    </span>
                                    {styleConfig.tag && showFullTime && (
                                      <span className="text-[7px] font-extrabold scale-90 px-0.5 sm:px-1 py-[0.5px] rounded-xs bg-black/10 shrink-0 select-none whitespace-nowrap hidden xs:inline">
                                        {styleConfig.tag}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <span className="font-sans text-[9px] sm:text-[10.5px] font-black tracking-tight truncate flex-1 leading-none select-none whitespace-nowrap">
                                  {eventLabel}
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
            </div>
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
