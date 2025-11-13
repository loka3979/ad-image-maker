import { NextRequest, NextResponse } from "next/server";
import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";

export const runtime = "nodejs";

type LayoutKey = "sym" | "asym" | "four" | "wide" | "topBottom" | "leftRight";

async function fileToBuffer(file: File | null) {
  if (!file) return null;
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

function drawTextBlock(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  // font & màu chữ cơ bản; bạn sẽ map thêm textColor/manualHex ở bước 4
  ctx.font = "bold 60px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lines: string[] = [];
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    const wpx = ctx.measureText(test).width;
    if (wpx > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lh = 72; // line-height
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh));
}

async function composeOne(opts: {
  size: number;
  layout: LayoutKey;
  bgMode: "color" | "image";
  bgColor: string;
  bgImageBuf: Buffer | null;
  portraitBuf: Buffer | null;
  title: string;
  subtitle: string;
}) {
  const { size, layout, bgMode, bgColor, bgImageBuf, portraitBuf, title, subtitle } = opts;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // 1) Nền
  if (bgMode === "color" || !bgImageBuf) {
    ctx.fillStyle = bgColor || "#0ea5e9";
    ctx.fillRect(0, 0, size, size);
  } else {
    // phủ ảnh nền
    const bg = await loadImage(await sharp(bgImageBuf).resize(size, size, { fit: "cover" }).png().toBuffer());
    ctx.drawImage(bg, 0, 0, size, size);
  }

  // 2) Ảnh chân dung (chưa tách nền – sẽ thêm bước tách nền sau)
  let portraitImg: any = null;
  if (portraitBuf) {
    const pBuf = await sharp(portraitBuf).resize(Math.floor(size * 0.55)).png().toBuffer();
    portraitImg = await loadImage(pBuf);
  }

  // 3) Vẽ theo layout
  const pad = Math.floor(size * 0.06);
  const textAreaW = size - pad * 2;

  switch (layout) {
    case "leftRight":
    case "asym": {
      const half = Math.floor((size - pad * 3) / 2);
      // ảnh trái, text phải
      if (portraitImg) ctx.drawImage(portraitImg, pad, pad, half + pad, size - pad * 2);
      drawTextBlock(ctx, `${title}\n${subtitle}`, pad * 2 + half, pad, half,);
      break;
    }
    case "topBottom": {
      const halfH = Math.floor((size - pad * 3) / 2);
      if (portraitImg) ctx.drawImage(portraitImg, pad, pad, size - pad * 2, halfH + pad);
      drawTextBlock(ctx, `${title}\n${subtitle}`, pad, pad * 2 + halfH, textAreaW);
      break;
    }
    case "wide": {
      // "wide" = chân dung chiếm ~65% ngang bên trái; text bên phải
      const leftW = Math.floor(size * 0.65) - pad * 2;
      if (portraitImg) ctx.drawImage(portraitImg, pad, pad, leftW, size - pad * 2);
      drawTextBlock(ctx, `${title}\n${subtitle}`, pad + leftW + pad, pad, size - (leftW + pad * 3));
      break;
    }
    case "four": {
      // grid 2x2: ảnh trên trái, text ở 3 ô còn lại (đơn giản)
      const cell = Math.floor((size - pad * 3) / 2);
      if (portraitImg) ctx.drawImage(portraitImg, pad, pad, cell, cell);
      drawTextBlock(ctx, `${title}\n${subtitle}`, pad + cell + pad, pad, cell);
      drawTextBlock(ctx, `${subtitle}`, pad, pad + cell + pad, cell * 2 + pad);
      break;
    }
    case "sym":
    default: {
      // ảnh trung tâm + text dưới
      if (portraitImg) {
        const w = Math.floor(size * 0.6);
        const x = Math.floor((size - w) / 2);
        ctx.drawImage(portraitImg, x, pad, w, w);
      }
      drawTextBlock(ctx, `${title}\n${subtitle}`, pad, Math.floor(size * 0.72), textAreaW);
      break;
    }
  }

  // 4) Xuất PNG base64
  const out = canvas.toBuffer("image/png");
  return `data:image/png;base64,${out.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const text = (form.get("text") as string) || "";
    const [title, ...rest] = text.split("\n");
    const subtitle = rest.join("\n");
    const layout = (form.get("layout") as LayoutKey) || "sym";
    const bgTab = ((form.get("bgTab") as string) === "image" ? "image" : "color") as "color" | "image";
    const bgColor = (form.get("bgColor") as string) || "#0ea5e9";

    const portrait = (form.get("portrait") as File) || null;
    const bgImage = (form.get("bgImage") as File) || null;

    const [portraitBuf, bgImageBuf] = await Promise.all([
      fileToBuffer(portrait),
      fileToBuffer(bgImage),
    ]);

    const img = await composeOne({
      size: 1024,
      layout,
      bgMode: bgTab,
      bgColor,
      bgImageBuf,
      portraitBuf,
      title,
      subtitle,
    });

    // có thể tạo 3 biến thể nếu muốn:
    // const imgs = await Promise.all([0,1,2].map(()=>composeOne({...})));

    return NextResponse.json({ suggestion: "OK", images: [img] });
  } catch (e: any) {
    return NextResponse.json({ suggestion: `Server error: ${e?.message || e}`, images: [] }, { status: 500 });
  }
}
