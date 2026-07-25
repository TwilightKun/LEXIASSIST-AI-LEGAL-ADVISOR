// src/middleware.ts
import { withAuth } from "next-auth/middleware";

// Explicitly define and export the middleware function
export default withAuth({
  pages: {
    signIn: "/login", // Fallback to standard login if unauthorized
  },
});

// Protect both the dashboard and the individual case routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/case/:path*",
  ],
};