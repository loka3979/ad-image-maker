// app/api/design/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stub API: hiện tại app render ảnh hoàn toàn trên client,
// nên tạm thời tắt chức năng thiết kế server để tránh lỗi build trên Vercel.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      message: "The /api/design endpoint is disabled in this deployment.",
      images: [],
    },
    { status: 501 }
  );
}
