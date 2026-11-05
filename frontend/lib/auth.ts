import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { cache } from "react";
import GoogleProvider from "next-auth/providers/google";
import { BackendError, backendFetch, type BackendUser, type Role } from "./backend";

/**
 * Configuración de Auth.js (next-auth v4). Google hace el inicio de sesión; al entrar,
 * el servidor de Next avisa al backend Julia, que guarda o actualiza al usuario en
 * PostgreSQL. La sesión vive en una cookie cifrada (JWT) con el id del usuario en la base y
 * su rol (`user` o `admin`). Pasado un minuto desde el inicio de sesión, el rol se vuelve a
 * leer de la base en cada carga de página: sin SessionProvider, el token renovado no se
 * vuelve a escribir en la cookie, así que la lectura se repite (una vez por solicitud).
 *
 * Variables de entorno (solo del servidor): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * NEXTAUTH_SECRET, NEXTAUTH_URL, BACKEND_URL e INTERNAL_API_KEY.
 */

/** Perfil que entrega Google en el token de identidad (OpenID Connect). */
interface GoogleOidcProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

// Cada cuánto se vuelve a leer el rol de la base para la sesión. Solo afecta la navegación:
// los datos de admin los vuelve a verificar el backend en cada solicitud.
const ROLE_REFRESH_MS = 60_000;

/**
 * Guarda o actualiza al usuario en el backend (POST /api/internal/users/google).
 * Devuelve `null` si el backend no responde o rechaza la solicitud; en ese caso no se
 * abre sesión, para no tener sesiones de usuarios que no existen en la base.
 */
async function syncUser(profile: { sub: string; email: string; name: string | null }): Promise<BackendUser | null> {
  try {
    return await backendFetch<BackendUser>("/api/internal/users/google", {
      method: "POST",
      body: { google_sub: profile.sub, email: profile.email, name: profile.name },
    });
  } catch (error) {
    console.error("[auth] no se pudo guardar el usuario en el backend:", error instanceof BackendError ? `${error.status} ${error.code}` : error);
    return null;
  }
}

/**
 * Rol actual del usuario según la base, o `null` si ya no existe. Si el backend falla, se
 * conserva el rol anterior: un corte momentáneo no debe cerrar la sesión.
 */
async function currentRole(userId: string, fallback: Role): Promise<Role | null> {
  try {
    return (await backendFetch<BackendUser>(`/api/internal/users/${encodeURIComponent(userId)}`)).role;
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    return fallback;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  // Los errores de inicio de sesión vuelven a /login con ?error=...
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    /**
     * Solo entra quien tiene correo verificado por Google y quedó guardado en la base.
     * El id de la base se pasa al callback `jwt` a través de `user.id`. Cuando se rechaza,
     * se vuelve a /login con un código propio para que el mensaje diga la causa real.
     */
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return false;
      const google = profile as GoogleOidcProfile | undefined;
      if (!google?.sub || !google.email) return false;
      if (google.email_verified !== true) return "/login?error=EmailNotVerified";
      const saved = await syncUser({ sub: google.sub, email: google.email, name: google.name ?? null });
      if (!saved) return "/login?error=ServiceUnavailable";
      user.id = saved.id;
      user.email = saved.email;
      user.name = saved.display_name;
      user.role = saved.role;
      return true;
    },
    /**
     * Al entrar, guarda en el token el id y el rol del usuario en la base. Después, cada
     * minuto vuelve a leer el rol, para que un ascenso o una baja se reflejen sin volver a
     * entrar. Si el usuario ya no existe, el token queda sin id y la sesión se trata como cerrada.
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role ?? "user";
        token.roleCheckedAt = Date.now();
        return token;
      }
      if (typeof token.userId === "string" && Date.now() - (token.roleCheckedAt ?? 0) > ROLE_REFRESH_MS) {
        const role = await currentRole(token.userId, token.role ?? "user");
        if (role === null) {
          delete token.userId;
          delete token.role;
        } else {
          token.role = role;
        }
        token.roleCheckedAt = Date.now();
      }
      return token;
    },
    /** Expone el id de la base y el rol en la sesión que leen las páginas. */
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
        session.user.role = token.role ?? "user";
      }
      return session;
    },
  },
};

/**
 * Sesión del usuario actual en componentes de servidor, o `null` si no entró. Una sesión
 * sin id (el usuario ya no existe en la base) cuenta como cerrada en todas partes: si /login
 * y /app la juzgaran distinto, se redirigirían entre sí sin fin.
 *
 * `cache` hace que el layout y la página de una misma solicitud compartan una sola lectura
 * (y una sola consulta del rol al backend).
 */
export const getSession = cache(async () => {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? session : null;
});
