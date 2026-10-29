import type { DefaultSession } from "next-auth";

// Agrega el id del usuario en la base (app_users.id) a la sesión y al token de Auth.js.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
