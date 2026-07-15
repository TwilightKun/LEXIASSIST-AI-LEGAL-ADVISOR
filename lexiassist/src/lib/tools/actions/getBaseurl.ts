// lib/tools/actions/getBaseurl.ts
export function getBaseUrl(req: Request) {
  const origin = new URL(req.url).origin;

  // Local development: use the public tunnel URL
  if (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("[::1]")
  ) {
    return process.env.NEXT_PUBLIC_APP_URL!;
  }

  return origin;
}