// src/app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

const f = createUploadthing();

export const ourFileRouter = {
  // Define the route for PDF uploads, max 16MB
  pdfUploader: f({ pdf: { maxFileSize: "16MB", maxFileCount: 1 } })
    // SECURITY FIX: Require an active session before allowing uploads
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        throw new Error("Unauthorized: You must be logged in to upload files.");
      }
      // Pass the userId down to the onUploadComplete handler
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Once uploaded, UploadThing gives us the exact URL database needs
      console.log(`Upload complete for user ${metadata.userId}! File URL:`, file.url);
      
      return { fileUrl: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;