import type { APIRoute } from "astro";
import { isSalonManager } from "../../../lib/auth";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  loadAllReports,
  parseReportRange,
  reportsToCsv,
} from "../../../lib/reports";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Manager access required", 403);
  }

  const url = new URL(context.request.url);
  const range = parseReportRange(url.searchParams);

  try {
    const reports = await loadAllReports(auth.supabase, range);

    if (url.searchParams.get("format") === "csv") {
      const csv = reportsToCsv(reports);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="salon-citrine-reports.csv"`,
        },
      });
    }

    return jsonOk({ reports });
  } catch (error) {
    console.error("reports load failed", error);
    return jsonError("Failed to load reports", 500);
  }
};
