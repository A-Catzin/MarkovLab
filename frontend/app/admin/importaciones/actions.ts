"use server";

import { revalidatePath } from "next/cache";
import { BackendError, backendFetch } from "@/lib/backend";
import { requireAdmin } from "@/lib/guards";

/** Resultado de una importación, como lo devuelve el backend. */
export interface ImportResult {
  symbol: string | null;
  status: "success" | "partial" | "failed";
  valid_rows: number;
  inserted: number;
  already_stored: number;
  invalid_count: number;
  invalid: { line: number; message: string }[];
  file_duplicates_count: number;
}

/** Datos del formulario; se devuelven cuando hay error para no perder lo escrito. */
export interface ImportFormValues {
  name: string;
  market: string;
  category: string;
  currency: string;
  symbol: string;
}

export interface ImportFormState {
  result: ImportResult | null;
  error: string | null;
  values?: ImportFormValues;
}

// Mismo tope que el backend (MAX_UPLOAD_CSV_LENGTH, en caracteres). Un carácter ocupa al menos un
// byte, así que un archivo que pasa este límite nunca excede el del backend.
const MAX_FILE_BYTES = 5_000_000;

/** Mensajes en español para los errores de entrada que el backend devuelve en inglés. */
function friendlyError(message: string) {
  if (message.includes("one asset per file")) return `El archivo trae varios activos (${message.split("found ")[1] ?? ""}). Sube un archivo por activo.`;
  if (message.includes("but the asset is")) return "El símbolo indicado no coincide con el del archivo.";
  if (message.includes("missing required columns")) return `Al archivo le faltan columnas: ${message.split(": ")[1] ?? ""}.`;
  if (message.includes("empty")) return "El archivo está vacío.";
  if (message.includes("currency")) return "La moneda tiene que ser un código de tres letras, como MXN o USD.";
  if (message.includes("symbol")) return "El archivo no tiene columna Symbol: indica el símbolo en el formulario.";
  return `El archivo no se pudo importar: ${message}`;
}

/**
 * Importa un CSV de precios desde /admin/importaciones. La sesión tiene que ser de un admin,
 * y el backend vuelve a verificarlo en la base. Devuelve el resumen para mostrarlo en la página.
 */
export async function importCsv(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  const admin = await requireAdmin();
  const values: ImportFormValues = {
    name: String(formData.get("name") ?? ""),
    market: String(formData.get("market") ?? ""),
    category: String(formData.get("category") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
  };
  const fail = (error: string): ImportFormState => ({ result: null, error, values });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Elige un archivo CSV.");
  if (file.size > MAX_FILE_BYTES) return fail("El archivo pesa más de 5 MB.");
  // `required` no impide escribir solo espacios: se revisa aquí para dar el mensaje correcto.
  if (!values.name.trim() || !values.market.trim() || !values.category.trim())
    return fail("Completa el nombre, el mercado y la categoría del activo.");

  try {
    const result = await backendFetch<ImportResult>("/api/internal/admin/prices/import", {
      method: "POST",
      actorId: admin.id,
      body: { csv: await file.text(), ...values },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/importaciones");
    revalidatePath("/admin/activos");
    return { result, error: null };
  } catch (error) {
    if (error instanceof BackendError && error.status === 400) return fail(friendlyError(error.message));
    if (error instanceof BackendError && error.status === 403) return fail("Tu cuenta ya no tiene permisos de admin.");
    console.error("[importaciones] no se pudo importar:", error);
    return fail("No pudimos importar el archivo porque el servidor no responde. Inténtalo en unos minutos.");
  }
}
