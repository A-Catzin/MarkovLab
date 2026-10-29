import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Configuración de Auth.js (next-auth v4). Google hace el inicio de sesión; al entrar,
 * el servidor de Next avisa al backend Julia, que guarda o actualiza al usuario en
 * PostgreSQL. La sesión vive en una cookie cifrada (JWT) con el id del usuario en la base.
 *
 * Variables de entorno (solo del servidor): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * NEXTAUTH_SECRET, NEXTAUTH_URL, BACKEND_URL e INTERNAL_API_KEY.
 */

interface BackendUser {
  id: string;
  email: string;
  display_name: string | null;
}

/** Perfil que entrega Google en el token de identidad (OpenID Connect). */
interface GoogleOidcProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

// Margen para el primer llamado después de arrancar el backend (conexión al pooler de Supabase).
const BACKEND_TIMEOUT_MS = 10_000;

/**
 * Guarda o actualiza al usuario en el backend (POST /api/internal/users/google).
 * Devuelve `null` si el backend no responde o rechaza la solicitud; en ese caso no se
 * abre sesión, para no tener sesiones de usuarios que no existen en la base.
 */
async function syncUser(profile: { sub: string; email: string; name: string | null }): Promise<BackendUser | null> {
  const baseUrl = process.env.BACKEND_URL;
  const key = process.env.INTERNAL_API_KEY;
  if (!baseUrl || !key) {
    console.error("[auth] BACKEND_URL o INTERNAL_API_KEY no están configuradas");
    return null;
  }
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": key },
      body: JSON.stringify({ google_sub: profile.sub, email: profile.email, name: profile.name }),
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[auth] el backend rechazó el usuario: HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as BackendUser;
  } catch (error) {
    console.error("[auth] no se pudo contactar al backend", error);
    return null;
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
      return true;
    },
    /** Al entrar, guarda en el token el id del usuario en la base. */
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    /** Expone el id de la base en la sesión que leen las páginas. */
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};

/** Sesión del usuario actual en componentes de servidor, o `null` si no entró. */
export function getSession() {
  return getServerSession(authOptions);
}
