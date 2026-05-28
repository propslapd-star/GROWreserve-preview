import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// We'll write a custom ICS parser to avoid third-party library typing issue or installation failures.
interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string; // ISO string
  end: string; // ISO string
  isAllDay: boolean;
}

// Parse ICS date string to JavaScript Date
function parseIcsDate(dateStr: string, isUtcVal: boolean = false): Date {
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
      // Default to JST (UTC+9) if no timezone is provided or if in local JST
      const dateVal = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      );
      // We explicitly make it JST
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
}

// Parse ICS content and return events
function parseICS(icsContent: string): CalendarEvent[] {
  // 1. Unfold lines (lines starting with space/tab are folded lines)
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

    // key might contain parameters like;TZID=Asia/Tokyo
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
        // EXDATE can have multiple comma-separated values
        const dates = value.split(",");
        currentEvent.exdates.push(...dates);
      }
    }
  }

  const expandedEvents: CalendarEvent[] = [];
  const rangeStart = new Date("2026-05-01T00:00:00");
  const rangeEnd = new Date("2026-07-31T23:59:59"); // 3 months around our local time of May 2026

  for (const ev of rawEvents) {
    if (!ev.dtstartRaw) continue;

    const summary = ev.summary || "(タイトルなし)";
    const description = ev.description || "";
    const location = ev.location || "";
    const uid = ev.uid || Math.random().toString();
    const isAllDay = !!ev.isAllDay;

    const startLocal = parseIcsDate(ev.dtstartRaw, ev.dtstartRaw.endsWith("Z"));
    const endLocal = ev.dtendRaw 
      ? parseIcsDate(ev.dtendRaw, ev.dtendRaw.endsWith("Z")) 
      : new Date(startLocal.getTime() + 60 * 60 * 1000); // 1 hour default

    const dur = endLocal.getTime() - startLocal.getTime();

    // Map of excluded times as string (YYYYMMDD or YYYYMMDDTHHMMSS)
    const exdateSet = new Set<string>();
    if (ev.exdates) {
      for (const ex of ev.exdates) {
        // Normalize EXDATE formats to YYYYMMDD or time
        const norm = ex.replace(/Z/, "").split("T")[0];
        exdateSet.add(norm); // check date match
        exdateSet.add(ex);   // check direct match
      }
    }

    if (!ev.rrule) {
      // Single normal event
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
      // Recurring event expansion
      // Simple parse of RRULE: FREQ=WEEKLY;UNTIL=...;BYDAY=...;INTERVAL=...
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
      const byday = rruleMap["BYDAY"]; // list of days, e.g. "MO,TU"

      const untilDate = untilStr ? parseIcsDate(untilStr, true) : rangeEnd;

      let currentStart = new Date(startLocal.getTime());
      let instancesCount = 0;

      // Map day abbreviations to JS day numbers
      const dayMap: Record<string, number> = {
        SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
      };

      const targetDays = byday ? byday.split(",").map(d => dayMap[d.trim()]) : [currentStart.getDay()];

      outerLoop:
      while (currentStart <= untilDate && currentStart <= rangeEnd && instancesCount < count) {
        // Expand window days
        // We look up to 45 days forward from the current start
        // and check if day matches the targetDays
        const checkDay = currentStart.getDay();
        if (targetDays.includes(checkDay)) {
          // Format current start to match with EXDATE
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

        // Increment currentStart
        if (freq === "DAILY") {
          currentStart.setDate(currentStart.getDate() + interval);
        } else if (freq === "WEEKLY") {
          // If we have BYDAY, we can step daily to check, but since we have a maximum range,
          // stepping daily is highly reliable and handles multiple week-days nicely.
          if (byday) {
            currentStart.setDate(currentStart.getDate() + 1);
          } else {
            currentStart.setDate(currentStart.getDate() + 7 * interval);
          }
        } else if (freq === "MONTHLY") {
          currentStart.setMonth(currentStart.getMonth() + interval);
        } else {
          // Safeguard break if unexpected FREQ
          break;
        }

        // Infinite loop safeguard
        if (currentStart.getTime() === startLocal.getTime() && freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") {
          break;
        }
      }
    }
  }

  return expandedEvents;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Cached calendar events to avoid rate-limiting and speed up front-end
  let cachedEvents: CalendarEvent[] = [];
  let cachedIsDemo = false;
  let cacheTime = 0;
  const CACHE_MS = 10 * 1000; // 10 seconds short cache for super responsive syncing

  app.get("/api/events", async (req, res) => {
    try {
      const now = Date.now();
      const forceRefresh = req.query.force === "true";
      const calendarId = "a79cd2a8ae67693a2b41f2d2ebd6cbd225f24c2573a95c420812d483ad07edc7@group.calendar.google.com";
      
      // Cache-busting URL parameter direct to Google to fetch fresh state instantly
      const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics?nocache=${now}`;

      // Return cache if valid
      if (!forceRefresh && cachedEvents.length > 0 && (now - cacheTime < CACHE_MS)) {
        return res.json({ success: true, events: cachedEvents, isDemo: cachedIsDemo, fromCache: true });
      }

      console.log(`Fetching Google Calendar events from: ${icsUrl}`);
      const response = await fetch(icsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ICS feed: ${response.statusText}`);
      }

      const icsText = await response.text();
      const parsed = parseICS(icsText);

      // Sort chronological
      parsed.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      let finalEvents = parsed;
      let isDemoMode = false;

      // If the public ICS feed has absolutely 0 events (very common if calendar visibility is set to 'See only free/busy' or completely wrong sharing config),
      // we provide high quality live preview demo events so the layout stays fully gorgeous and functional for visual updates.
      if (parsed.length === 0) {
        isDemoMode = true;
        finalEvents = [
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
      }

      cachedEvents = finalEvents;
      cachedIsDemo = isDemoMode;
      cacheTime = now;

      res.json({ success: true, events: finalEvents, isDemo: isDemoMode, fromCache: false });
    } catch (err: any) {
      console.error("Error fetching or parsing calendar ICS feed:", err.message);
      // Return stale cache if available, else error
      if (cachedEvents.length > 0) {
        return res.json({ success: true, events: cachedEvents, isDemo: cachedIsDemo, fromCache: true, staleError: err.message });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // Vite development middleware or production static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
