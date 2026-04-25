import { NextResponse } from "next/server";
import { createAccount, listAccounts } from "@/lib/mail-service";
import type { AccountInput } from "@/lib/types";

export async function GET() {
  const accounts = await listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as AccountInput;

    if (!input.email || !input.protocol || !input.provider) {
      return NextResponse.json({ error: "email、protocol、provider 为必填项。" }, { status: 400 });
    }

    const account = await createAccount(input);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建账户失败。" }, { status: 400 });
  }
}
