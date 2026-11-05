import type { Metadata } from "next";
import { AdminError } from "@/components/app/AdminError";
import { getAdminUsers, loadAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/guards";
import { changeRole } from "./actions";

export const metadata: Metadata = {
  title: "Usuarios · Admin · MarkovLab",
  description: "Usuarios de MarkovLab y su rol.",
};

/** Mensajes para los resultados que deja la acción `changeRole` en la URL. */
const ERROR_MESSAGES: Record<string, string> = {
  last_admin: "No se puede quitar el rol de admin al último admin: el sistema siempre necesita al menos uno.",
  forbidden: "Tu cuenta ya no tiene permisos de admin.",
  not_found: "Ese usuario ya no existe.",
  invalid: "Elige un rol válido.",
};
const DEFAULT_ERROR = "No pudimos cambiar el rol. Inténtalo de nuevo.";
const ROLE_LABELS = { user: "Usuario", admin: "Admin" } as const;

/** Lista de usuarios con su rol y un botón para cambiarlo. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { ok, error: actionError } = await searchParams;
  const result = await loadAdmin(() => getAdminUsers(admin.id));

  return (
    <>
      <h1>Usuarios</h1>
      <p className="shell__lead">
        Todo el que entra con Google es usuario. Los admins además ven esta sección y pueden cambiar roles.
      </p>
      {ok && (
        <p className="notice" role="status">
          Rol actualizado a {ROLE_LABELS[ok as keyof typeof ROLE_LABELS] ?? ok}.
        </p>
      )}
      {actionError && (
        <p className="notice notice--error" role="alert">
          {ERROR_MESSAGES[actionError] ?? DEFAULT_ERROR}
        </p>
      )}
      {result.error !== null ? (
        <AdminError message={result.error} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Usuarios y roles</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((user) => {
                const next = user.role === "admin" ? "user" : "admin";
                const isSelf = user.id === admin.id;
                return (
                  <tr key={user.id}>
                    <th scope="row">
                      {user.display_name ?? "—"}
                      {isSelf && <span className="data-table__hint"> (tú)</span>}
                    </th>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role role--${user.role}`}>{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td className="data-table__action">
                      <form action={changeRole}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="role" value={next} />
                        <button type="submit" className="button button--small button--quiet">
                          {next === "admin" ? "Hacer admin" : isSelf ? "Dejar de ser admin" : "Quitar admin"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
