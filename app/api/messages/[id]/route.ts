import { NextResponse } from "next/server";
import { deleteMessage, getMessageById, updateMessage } from "@/lib/mail-service";
import type { SendMailInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const message = await getMessageById(id);
    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "获取邮件失败。" }, { status: 404 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as Partial<SendMailInput>;
    const message = await updateMessage(id, input);
    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新邮件失败。" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteMessage(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除邮件失败。" }, { status: 400 });
  }
}
