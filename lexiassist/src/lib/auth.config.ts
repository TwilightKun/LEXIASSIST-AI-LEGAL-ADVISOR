import { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        // Robust check: Ensure user exists and the password field is populated
        // Note: Post-deployment, ensure passwords are hashed (e.g., bcrypt)
        if (user && user.password && user.password === credentials.password) {
          return { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role 
          };
        }
        
        return null;
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
        session.user.role = token.role;
        session.user.id = token.id || (token.sub as string); // fallback
      }
      return session;
    }
  }
};