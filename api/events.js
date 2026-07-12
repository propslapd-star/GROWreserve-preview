// Vercel Serverless Function: api/events.js

function parseIcsDate(dateStr, isUtcVal = false) {
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

function parseICS(icsContent) {
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const rawEvents = [];
  let currentEvent = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const keyPart = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);
    const key = keyPart.split(";")[0].toUpperCase();

    if (key === "BEGIN" && value.toUpperCase() === "VEVENT") {
      currentEvent = {
        exdates: [],
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

  const expandedEvents = [];
  // Dynamically set range to cover 3 months before and 3 months after today
  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 3, 1, 0, 0, 0);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 4, 0, 23, 59, 59);

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
      : new Date(startLocal.getTime() + 60 * 60 * 1000);

    const dur = endLocal.getTime() - startLocal.getTime();

    const exdateSet = new Set();
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
      const rruleMap = {};
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

      const untilDate = untilStr ? parseIcsDate(untilStr, true) : rangeEnd;

      let currentStart = new Date(startLocal.getTime());
      let instancesCount = 0;

      const dayMap = {
        SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
      };

      const targetDays = byday ? byday.split(",").map(d => dayMap[d.trim()]) : [currentStart.getDay()];

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
}

const getDemoEvents = () => {
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
}

export default async function handler(req, res) {
  // CORS configurations for standard requests
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const calendarId = "a79cd2a8ae67693a2b41f2d2ebd6cbd225f24c2573a95c420812d483ad07edc7@group.calendar.google.com";
    const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics?nocache=${Date.now()}`;

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

    if (parsed.length === 0) {
      isDemoMode = true;
      finalEvents = getDemoEvents();
    }

    res.status(200).json({ success: true, events: finalEvents, isDemo: isDemoMode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, events: getDemoEvents(), isDemo: true });
  }
}
