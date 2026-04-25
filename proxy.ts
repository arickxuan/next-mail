import { NextResponse, type NextRequest } from "next/server";

const ADMIN_TOKEN_HEADER = "X-ADMIN-TOKEN";

export function proxy(request: NextRequest) {
  const expectedToken = process.env["X-ADMIN-TOKEN"] || process.env.X_ADMIN_TOKEN;
  const actualToken = request.headers.get(ADMIN_TOKEN_HEADER);

  if (!expectedToken) {
    return NextResponse.json({ error: "服务端未配置 X-ADMIN-TOKEN。" }, { status: 500 });
  }

  if (!actualToken || actualToken !== expectedToken) {
    return NextResponse.json({ error: "token 错误。" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
