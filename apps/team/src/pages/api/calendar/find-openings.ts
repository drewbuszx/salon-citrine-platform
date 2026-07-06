import type { APIRoute } from "astro";

import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  findOpenGaps,
  formatDayParam,
  loadCalendarData,
  parseDayParam,
  shiftDay,
} from "../../../lib/calendar";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const url = context.url.searchParams;

  const fromParam = url.get("from") ?? formatDayParam(new Date());
  const days = Math.min(Math.max(Number(url.get("days") ?? 7), 1), 14);
  const duration = Math.min(
    Math.max(Number(url.get("duration") ?? 60), 15),
    480,
  );
  const maxResults = Math.min(Math.max(Number(url.get("limit") ?? 12), 1), 24);
  const staffId = url.get("staff_id");

  let startDay: Date;
  try {
    startDay = parseDayParam(fromParam);
  } catch {
    return jsonError("Invalid from date", 400);
  }

  const managerView = isSalonManager(staff);
  const staffFilterIds = managerView ? null : [staff.id];

  const allResults: Array<{
    staffId: string;
    staffName: string;
    startsAt: string;
    endsAt: string;
    dayParam: string;
    label: string;
    sortKey: number;
  }> = [];

  for (let offset = 0; offset < days; offset++) {
    const day = shiftDay(startDay, offset);
    const dayParam = formatDayParam(day);

    let calendar;
    try {
      calendar = await loadCalendarData(supabase, {
        selectedDay: day,
        staffFilterIds,
      });
    } catch (error) {
      console.error("find-openings load failed", error);
      continue;
    }

    const staffList =
      staffId && staffId !== "all"
        ? calendar.staff.filter((member) => member.id === staffId)
        : calendar.staff;

    const gaps = findOpenGaps(
      day,
      dayParam,
      staffList,
      calendar.appointments,
      calendar.blockedTimes,
      calendar.staffSchedules ?? {},
      {
        minDurationMinutes: duration,
        maxResults: maxResults - allResults.length,
        staffIds: staffId && staffId !== "all" ? [staffId] : null,
      },
    );

    for (const gap of gaps) {
      allResults.push({
        staffId: gap.staffId,
        staffName: gap.staffName,
        startsAt: gap.startsAt,
        endsAt: gap.endsAt,
        dayParam: gap.dayParam,
        label: gap.label,
        sortKey: new Date(gap.startsAt).getTime(),
      });
      if (allResults.length >= maxResults) break;
    }

    if (allResults.length >= maxResults) break;
  }

  allResults.sort((a, b) => a.sortKey - b.sortKey);

  return jsonOk({
    openings: allResults.map(({ sortKey: _sortKey, ...rest }) => rest),
  });
};
