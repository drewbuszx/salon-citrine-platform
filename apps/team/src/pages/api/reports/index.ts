import type { APIRoute } from "astro";
import { isSalonManager } from "../../../lib/auth";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  loadAllReports,
  loadReportDetail,
  parseReportRange,
  reportsCsvFilename,
  reportsToCsv,
} from "../../../lib/reports";
import { resolveCompareRange, type CompareMode } from "../../../lib/report-range";

const COMPARE_MODES = new Set(["previous", "previous-month", "last-year"]);

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Manager access required", 403);
  }

  const url = new URL(context.request.url);
  const range = parseReportRange(url.searchParams);

  try {
    // Drill-down: underlying records for a summary total.
    const detailKind = url.searchParams.get("detail");
    if (detailKind) {
      const detail = await loadReportDetail(auth.supabase, range, {
        kind: detailKind,
        status: url.searchParams.get("status"),
        staffId: url.searchParams.get("staffId"),
      });
      return jsonOk({ detail });
    }

    const compareParam = url.searchParams.get("compare");
    const compareRange =
      compareParam && COMPARE_MODES.has(compareParam)
        ? resolveCompareRange(range, compareParam as CompareMode)
        : null;

    const reports = await loadAllReports(auth.supabase, range, compareRange);

    if (url.searchParams.get("format") === "csv") {
      const csv = reportsToCsv(reports);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportsCsvFilename(range)}"`,
        },
      });
    }

    return jsonOk({ reports });
  } catch (error) {
    console.error("reports load failed", error);
    return jsonError("Failed to load reports", 500);
  }
};
