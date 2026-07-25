// src/app/api/webrtc/signal/route.ts
import { NextResponse } from "next/server";
import { pusher } from "@/lib/pusher/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  // Gate check: Must be an authenticated user
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { room, type, payload, sender } = body;

    if (!room || typeof room !== "string") {
      return NextResponse.json({ error: "Missing room parameter" }, { status: 400 });
    }

    // Lookup the consultation room in the database to verify ownership
    const consultation = await prisma.consultation.findUnique({
      where: { webrtcRoomId: room },
      select: {
        caseBrief: {
          select: { clientId: true, lawyer: { select: { userId: true } } },
        },
      },
    });

    const userId = auth.session.user.id;
    
    // SECURITY FIX: Confirm the user is actually supposed to be in this specific room
    const isParticipant =
      consultation &&
      (consultation.caseBrief.clientId === userId ||
        consultation.caseBrief.lawyer?.userId === userId);

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden: You are not a participant of this room." }, { status: 403 });
    }

    // Bounce the signal to the specific room channel using 'pusher.trigger'
    await pusher.trigger(`room-${room}`, 'webrtc-signal', {
      type,
      payload,
      sender
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signaling Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}