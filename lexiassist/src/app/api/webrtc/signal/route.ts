// src/app/api/webrtc/signal/route.ts
import { NextResponse } from "next/server";
import { pusher } from "@/lib/pusher/server"; // MATCHED: Now importing 'pusher' directly

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { room, type, payload, sender } = body;

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