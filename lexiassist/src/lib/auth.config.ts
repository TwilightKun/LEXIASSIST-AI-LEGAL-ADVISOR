// src/lib/auth.config.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Development Login",
      credentials: {
        username: { label: "Username (type 'lawyer')", type: "text", placeholder: "lawyer" },
        password: { label: "Password (type 'password')", type: "password" }
      },
      async authorize(credentials) {
        if (credentials?.username === "lawyer" && credentials?.password === "password") {
          return { id: "1", name: "Lead Attorney", email: "lawyer@lexiassist.com", role: "lawyer" };
        }
        return null;
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    }
  }
};