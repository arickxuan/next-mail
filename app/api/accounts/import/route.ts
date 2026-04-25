import { NextResponse } from "next/server";
import { parseAccountsImport } from "@/lib/importer";
import { importAccounts } from "@/lib/mail-service";
import type { ImportRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ImportRequest;
    const accounts = await importAccounts(parseAccountsImport(input));
    return NextResponse.json({ accounts }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入账户失败。" }, { status: 400 });
  }
}
