import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

type LayoutKey = "sym" | "asym" | "four" | "wide" | "topBottom" | "leftRight";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const text = String(fd.get("text") || "");
  const layout = String(fd.get("layout") || "sym") as LayoutKey;
  const textColor = String(fd.get("textColor") || "auto");
  const manualHex = String(fd.get("manualHex") || "#ffffff");
  const bgTab = String(fd.get("bgTab") || "color");
  const bgColor = String(fd.get("bgColor") || "#0ea5e9");
  const fxLight = String(fd.get("fxLight") || "false") === "true";
  const regen = String(fd.get("regen") || "false") === "true";

  const seed = Date.now().toString();
  const images = [
    `https://picsum.photos/seed/${seed}-1/1024/1024`,
    `https://picsum.photos/seed/${seed}-2/1024/1024`,
    `https://picsum.photos/seed/${seed}-3/1024/1024`,
  ];

  const suggestion = JSON.stringify(
    { input:{text,layout,textColor,manualHex,bgTab,bgColor,fxLight,regen},
      design:{layout,palette: textColor==="manual"?manualHex:"auto", bg: bgTab==="color"?bgColor:"image"} },
    null,2
  );

  return NextResponse.json({ suggestion, images, previewUrl: images[0] });
}
