// src/utils/uploadthing.ts
import { generateUploadDropzone } from "@uploadthing/react";
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

// Keeps your existing dropzone component intact just in case
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// Exports the hooks we need for the seamless inline chat upload
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();