// src/app/actions/register.ts
"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registrationLimiter } from "@/lib/rate-limit"; // <-- NEW IMPORT

const SALT_ROUNDS = 12;

export async function registerClient(formData: {
  name: string;
  email: string;
  password: string;
}) {
  const { name, email, password } = formData;

  // Prevent mass account spam by rate-limiting via IP address
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headerList.get("x-real-ip")
    || "unknown";

  const limitResult = await registrationLimiter.limit(ip);
  if (!limitResult.success) {
    return { success: false, error: "Too many registration attempts from this network. Please try again later." };
  }

  // 1. Basic input validation
  if (!name.trim() || !email.trim() || !password.trim()) {
    return { success: false, error: "All profile parameters must be filled." };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if the record already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Deliberately vague — don't confirm/deny which emails are registered.
      return { success: false, error: "Unable to create account with these details." };
    }

    // 3. Hash before it ever touches the database
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Create the new Client user profile
    await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
        role: "CLIENT",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[REGISTRATION ERROR] Failed to provision user:", error);
    return { success: false, error: "System isolation layer error during provisioning." };
  }
}