import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Rutas de Auth.js: inicio de sesión, callback de Google (/api/auth/callback/google), sesión y salida.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
