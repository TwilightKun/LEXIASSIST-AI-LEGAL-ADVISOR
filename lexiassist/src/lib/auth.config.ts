// src/lib/auth.config.ts
import { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginAttemptLimiter } from "@/lib/rate-limit";

// TYPESCRIPT AUGMENTATION
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

// CORE CONFIGURATION
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "LexiAssist Secure Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "client@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();

        // Throttle login attempts to prevent brute-forcing
        // This caps attempts at 10 per 15 minutes per submitted email.
        const limitResult = await loginAttemptLimiter.limit(normalizedEmail);
        if (!limitResult.success) {
          throw new Error("Too many login attempts. Please wait a few minutes and try again.");
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail }
        });

        // Fail safely and generically
        if (!user || !user.password) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24-hour strict session limit
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/", // Routes unauthorized access back to root landing page
  },
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = (token.id || token.sub) as string; // fallback
      }
      return session;
    }
  }
};