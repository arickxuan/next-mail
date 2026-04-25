import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/mail-service";
import type { SendMailInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SendMailInput;

    if (!input.accountId || !input.to || !input.subject) {
      return NextResponse.json({ error: "accountId、to、subject 为必填项。" }, { status: 400 });
    }

    const message = await sendMessage(input);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发送失败。" }, { status: 400 });
  }
}
