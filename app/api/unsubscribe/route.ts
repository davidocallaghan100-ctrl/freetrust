import { NextRequest, NextResponse } from "next/server";

const SALES_AI_RPC_URL = "https://sales-ai-outreach-davidocallaghan100829028694.adaptive.ai/rpc/unsubscribeFtContact";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    if (!email || typeof email !== "string") {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    // Call the sales-ai-outreach RPC to mark as unsubscribed in the sheet
    const rpcRes = await fetch(SALES_AI_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-adaptive-app-id": process.env.ADAPTIVE_APP_ID ?? "",
      },
      body: JSON.stringify([email]),
    });

    if (!rpcRes.ok) {
      console.error("Unsubscribe RPC failed:", rpcRes.status, await rpcRes.text());
      return NextResponse.json({ success: false, message: "Failed to process unsubscribe" }, { status: 500 });
    }

    const result = await rpcRes.json() as { success?: boolean; message?: string };
    return NextResponse.json(result);
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
