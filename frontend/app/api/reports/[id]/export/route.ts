import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchReportCsvExport } from "@/lib/modules/adapters/reports.server";

/**
 * Descarga en formato CSV de un reporte persistido perteneciente al usuario autenticado
 * (`GET /api/internal/reports/{id}/export?format=csv`). Nunca entrega archivos ficticios.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "unauthorized", message: "Debes iniciar sesión para exportar reportes." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { id } = await context.params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  const result = await fetchReportCsvExport({
    actorId: session.user.id,
    reportId: id,
    format,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": result.contentDisposition,
      "Cache-Control": "private, no-store",
    },
  });
}
