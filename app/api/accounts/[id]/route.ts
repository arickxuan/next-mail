import { NextResponse } from "next/server";
import { deleteAccount, updateAccount } from "@/lib/mail-service";
import type { AccountInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as Partial<AccountInput>;
    const account = await updateAccount(id, input);
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新账户失败。" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteAccount(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除账户失败。" }, { status: 400 });
  }
}
