import type { DefaultSession } from "next-auth";

type Role = "user" | "admin";

// Agrega el id del usuario en la base (usuarios.id) y su rol a la sesión y al token de Auth.js.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role: Role };
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    /** Momento (ms) en que se leyó el rol de la base por última vez. */
    roleCheckedAt?: number;
  }
}
