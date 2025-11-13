// app/api/gpt-layout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AskBody = {
  mode?: "layout" | "effect";
  title: string;
  subtitle: string;
  canvas?: { size: number };
  useImageBg?: boolean;
  hasPortrait?: boolean;
  bg?: { color?: string; overlayOn?: boolean; overlayOpacity?: number };
};

function hexToRgb(hex?: string) {
  if (!hex) return { r: 14, g: 165, b: 233 }; // #0ea5e9
  const s = hex.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map(c => c + c).join("") : s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminanceFromHex(hex?: string) {
  const { r, g, b } = hexToRgb(hex);
  const L = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AskBody;
    const size = body.canvas?.size ?? 1024;

    // ===== EFFECT MODE (cho checkbox hiệu ứng) =====
    if (body.mode === "effect") {
      const lum = luminanceFromHex(body.bg?.color);
      const lightOnDark = lum < 0.5; // nền tối -> ánh sáng rõ hơn
      const fx = {
        light: {
          position: body.hasPortrait ? "left" : "top",
          intensity: lightOnDark ? 0.24 : 0.16,
          radius: 0.75,
          color: "255,255,255",
        } as const,
        vignette: 0.25,
        tint: lightOnDark ? undefined : "rgba(0,0,0,0.08)",
      };
      return NextResponse.json({ ok: true, fx });
    }

    // ===== LAYOUT MODE (mặc định) =====
    const sys = `
Bạn là chuyên gia thiết kế social. Nhiệm vụ: SẮP XẾP 1 ảnh chân dung (đã tách nền), 1 nền, 2 đoạn text (title, body) vào KHUNG VUÔNG ${size}x${size} để xuất ảnh quảng cáo cuối.
KHÔNG thay đổi nội dung text.

Chỉ trả về JSON đúng schema (tọa độ chuẩn hóa 0..1):
{
  "image": { "x": 0..1, "y": 0..1, "w": 0..1, "h": 0..1 },
  "title": { "x":0..1, "y":0..1, "w":0..1, "size": 12..160, "align": "left"|"center"|"right" },
  "body":  { "x":0..1, "y":0..1, "w":0..1, "size": 10..80,  "align": "left"|"center"|"right" },
  "preferTextColor": "light" | "dark"
}
Nguyên tắc:
- Safe-margin tối thiểu 0.04 quanh viền.
- Không để text đè khuôn mặt; đặt text ở vùng trống.
- Nền tối -> preferTextColor = "light", nền sáng -> "dark".
- Nếu không có ảnh chân dung, tăng diện tích cho text.
Chỉ output JSON, không thêm mô tả.`.trim();

    const user = {
      role: "user",
      content: JSON.stringify({
        title: body.title,
        subtitle: body.subtitle,
        canvas: { size },
        useImageBg: !!body.useImageBg,
        hasPortrait: !!body.hasPortrait,
        bg: body.bg || {},
      }),
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, user],
        temperature: 0.2,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

    const clamp01 = (v: number) => Math.max(0, Math.min(1, Number(v)));
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Number(v)));
    const safeBox = (b: any, def: any) => ({
      x: clamp01(b?.x ?? def.x),
      y: clamp01(b?.y ?? def.y),
      w: clamp01(b?.w ?? def.w),
      h: clamp01(b?.h ?? def.h),
    });

    const out = {
      image: safeBox(json.image, { x: 0.04, y: 0.06, w: 0.56, h: 0.88 }),
      title: {
        x: clamp01(json.title?.x ?? 0.62),
        y: clamp01(json.title?.y ?? 0.12),
        w: clamp01(json.title?.w ?? 0.34),
        size: clamp(json.title?.size ?? 64, 12, 160),
        align: ["left", "center", "right"].includes(json.title?.align) ? json.title.align : "left",
      },
      body: {
        x: clamp01(json.body?.x ?? 0.62),
        y: clamp01(json.body?.y ?? 0.28),
        w: clamp01(json.body?.w ?? 0.34),
        size: clamp(json.body?.size ?? 22, 10, 80),
        align: ["left", "center", "right"].includes(json.body?.align) ? json.body.align : "left",
      },
      preferTextColor: json.preferTextColor === "dark" ? "dark" : "light",
    };

    return NextResponse.json({ ok: true, layout: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
