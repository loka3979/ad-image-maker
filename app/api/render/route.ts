import { NextResponse } from "next/server";
import { createCanvas, loadImage, CanvasRenderingContext2D } from "canvas";

export const runtime = "nodejs";

type Align = "left" | "center" | "right";
type Layout = {
  image: { x:number; y:number; w:number; h:number };   // 0..1
  title: { x:number; y:number; w:number; size:number; align:Align };
  body:  { x:number; y:number; w:number; size:number; align:Align };
  preferTextColor?: "light"|"dark";
};

type Req = {
  size?: number;                                // default 1024
  portraitDataUrl?: string | null;              // dataURL (đã tách nền)
  bgImageDataUrl?: string | null;               // dataURL (nếu dùng ảnh nền)
  bgColor?: string;                             // nếu không có ảnh nền
  overlayOn?: boolean;
  overlayOpacity?: number;                      // 0..1
  title: string;
  subtitle: string;
  titleFont?: string;                           // "Montserrat"
  bodyFont?: string;                            // "Roboto"
  textHex?: string;                             // màu chữ cuối cùng
  layout: Layout;                               // layout tuyệt đối GPT
};

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
){
  const words = text.split(/\s+/);
  let line = "", yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, yy);
      yy += lineHeight;
      line = words[i] + " ";
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Req;
    const S = b.size ?? 1024;

    const canvas = createCanvas(S, S);
    const ctx = canvas.getContext("2d");

    // BG
    if (b.bgImageDataUrl) {
      const bg = await loadImage(b.bgImageDataUrl);
      // cover
      const ir = bg.width / bg.height, tr = 1;
      let sx=0, sy=0, sw=bg.width, sh=bg.height;
      if (ir > tr) { sh = bg.height; sw = sh * tr; sx = (bg.width - sw) / 2; }
      else { sw = bg.width; sh = sw / tr; sy = (bg.height - sh) / 2; }
      ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, S, S);
      if (b.overlayOn) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(Math.max(b.overlayOpacity ?? 0.35,0),1)})`;
        ctx.fillRect(0,0,S,S);
      }
    } else {
      ctx.fillStyle = b.bgColor || "#0ea5e9";
      ctx.fillRect(0,0,S,S);
    }

    // Portrait
    if (b.portraitDataUrl) {
      const img = await loadImage(b.portraitDataUrl);
      const bx = Math.round(b.layout.image.x * S);
      const by = Math.round(b.layout.image.y * S);
      const bw = Math.round(b.layout.image.w * S);
      const bh = Math.round(b.layout.image.h * S);

      const ir = img.width / img.height;
      const tr = bw / bh;
      let sx=0, sy=0, sw=img.width, sh=img.height;
      if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; }
      else { sw = img.width; sh = sw / tr; sy = (img.height - sh) / 2; }

      ctx.drawImage(img, sx, sy, sw, sh, bx, by, bw, bh);
    }

    // Text color
    ctx.fillStyle = b.textHex || (b.layout.preferTextColor === "dark" ? "#111111" : "#ffffff");
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;

    // Title
    const t = b.layout.title;
    ctx.textAlign = t.align;
    ctx.font = `bold ${Math.max(12, Math.min(160, t.size))}px ${b.titleFont || "Montserrat"}, system-ui, Arial`;
    let tx = Math.round(t.x * S);
    const tw = Math.round(t.w * S);
    if (t.align === "center") tx = tx + tw/2;
    if (t.align === "right")  tx = tx + tw;
    drawWrappedText(ctx, b.title || "", tx, Math.round(t.y * S), tw, t.size * 1.15);

    // Body
    const d = b.layout.body;
    ctx.textAlign = d.align;
    ctx.font = `500 ${Math.max(10, Math.min(80, d.size))}px ${b.bodyFont || "Roboto"}, system-ui, Arial`;
    let bx = Math.round(d.x * S);
    const bw = Math.round(d.w * S);
    if (d.align === "center") bx = bx + bw/2;
    if (d.align === "right")  bx = bx + bw;
    if ((b.subtitle || "").trim()) {
      drawWrappedText(ctx, b.subtitle, bx, Math.round(d.y * S), bw, d.size * 1.2);
    }

    const url = canvas.toDataURL("image/jpeg", 0.92);
    return NextResponse.json({ ok:true, url });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || "render-failed" }, { status: 500 });
  }
}
