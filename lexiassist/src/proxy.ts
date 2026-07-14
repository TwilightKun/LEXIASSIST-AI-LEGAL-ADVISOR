import { withAuth } from "next-auth/middleware";

// Explicitly define and export the middleware function
export default withAuth({
  pages: {
    signIn: "/api/auth/signin", // Fallback to standard login if unauthorized
  },
});

// Protect the dashboard routes
export const config = {
  matcher: ["/dashboard/:path*"],
};