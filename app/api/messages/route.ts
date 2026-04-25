import { NextResponse } from "next/server";
import { createDraft, listMessages, syncAccountMessages } from "@/lib/mail-service";
import type { MailFolder, SendMailInput } from "@/lib/types";

const VALID_FOLDERS: MailFolder[] = ["inbox", "sent", "draft", "archive", "junk", "trash"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const folder = searchParams.get("folder") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  if (folder !== "all" && !VALID_FOLDERS.includes(folder as MailFolder)) {
    return NextResponse.json({ error: "无效的文件夹类型。" }, { status: 400 });
  }

  if (!accountId) {
    const result = await listMessages(undefined, folder, page, pageSize);
    return NextResponse.json(result);
  }

  try {
    const messages = await syncAccountMessages(accountId);
    const result = await listMessages(accountId, folder, page, pageSize);
    return NextResponse.json({ ...result, synced: true });
  } catch (error) {
    const result = await listMessages(accountId, folder, page, pageSize);
    return NextResponse.json(
      {
        ...result,
        synced: false,
        error: error instanceof Error ? error.message : "同步邮件失败。"
      },
      { status: result.messages.length ? 200 : 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as SendMailInput;
    const draft = await createDraft(input);
    return NextResponse.json({ message: draft }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存草稿失败。" }, { status: 400 });
  }
}
