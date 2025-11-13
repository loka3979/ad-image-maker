// app/api/removebg/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const apiKey = process.env.REMOVEBG_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing REMOVEBG_KEY" }, { status: 500 });

    const fd = new FormData();
    fd.append("image_file", file, (file as any).name || "portrait.jpg");
    fd.append("size", "auto");
    fd.append("format", "png");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        // ❌ ĐỪNG set Accept: "application/json"
      },
      body: fd,
    });

    if (!res.ok) {
      let err = "";
      try {
        const j = await res.json();
        err = j?.errors?.[0]?.title || JSON.stringify(j);
      } catch {
        err = await res.text();
      }
      return NextResponse.json(
        { error: `remove.bg ${res.status}: ${err}` },
        { status: res.status }
      );
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
