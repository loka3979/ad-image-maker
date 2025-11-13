"use client";
import { useEffect, useRef, useState } from "react";

/* ========= Types ========= */
type Align = "left" | "center" | "right";
type LogoPos = "top-left" | "top-right" | "watermark";
type LayoutKey =
  | "sym"
  | "asym"
  | "wideTop"
  | "wideBottom"
  | "leftTextRightImg"
  | "rightTextLeftImg"
  | "centerPortrait"
  | "quadTopLeft";

/* ========= Utils ========= */
function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    if (/^https?:\/\//i.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = (e) => rej(e);
    img.src = url;
  });
}

// Hỗ trợ Enter xuống dòng + giữ khoảng trắng (spacebar)
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  boxW: number,
  lineH: number,
  align: Align
) {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  let yy = y;

  const put = (t: string) => {
    let tx = x;
    if (align === "center") tx = x + boxW / 2;
    if (align === "right") tx = x + boxW;
    ctx.fillText(t, tx, yy);
  };

  for (const para of paragraphs) {
    // dòng trống: chỉ xuống dòng
    if (/^\s*$/.test(para)) {
      yy += lineH;
      continue;
    }

    // tách cả từ và khoảng trắng, giữ nguyên số space
    const tokens = para.split(/(\s+)/); // ví dụ: ["Xin", " ", "chào", "  ", "bạn"]
    let line = "";

    for (const token of tokens) {
      if (!token) continue;
      const test = line + token;
      if (ctx.measureText(test).width > boxW && line !== "") {
        // xuống dòng mới
        put(line);
        line = token.trim() ? token : ""; // nếu token chỉ là khoảng trắng thì bỏ
        yy += lineH;
      } else {
        line = test;
      }
    }

    if (line) {
      put(line);
      yy += lineH;
    }
  }
}

function getPortraitBaseRect(layout: LayoutKey, size: number) {
  const pad = Math.floor(size * 0.06);
  switch (layout) {
    case "sym": {
      const w = Math.floor(size * 0.46);
      const h = size - pad * 2;
      return { x: pad, y: pad, w, h };
    }
    case "asym": {
      const w = Math.floor(size * 0.58);
      const h = size - pad * 2;
      return { x: size - pad - w, y: pad, w, h };
    }
    case "wideTop": {
      const w = size - pad * 2;
      const h = Math.floor(size * 0.46);
      return { x: pad, y: pad, w, h };
    }
    case "wideBottom": {
      const w = size - pad * 2;
      const h = Math.floor(size * 0.46);
      return { x: pad, y: size - pad - h, w, h };
    }
    case "leftTextRightImg": {
      const w = Math.floor(size * 0.48);
      const h = size - pad * 2;
      return { x: size - pad - w, y: pad, w, h };
    }
    case "rightTextLeftImg": {
      const w = Math.floor(size * 0.48);
      const h = size - pad * 2;
      return { x: pad, y: pad, w, h };
    }
    case "centerPortrait": {
      const w = Math.floor(size * 0.6);
      const h = Math.floor(size * 0.6);
      return { x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2), w, h };
    }
    case "quadTopLeft": {
      const w = Math.floor((size - pad * 3) / 2);
      const h = w;
      return { x: pad, y: pad, w, h };
    }
    default: {
      const w = Math.floor(size * 0.5);
      const h = size - pad * 2;
      return { x: pad, y: pad, w, h };
    }
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
  alignHPercent: number,
  alignVPercent: number,
  scalePercent: number
) {
  const { w: cw, h: ch } = rect;
  const ir = img.width / img.height;
  const tr = cw / ch;

  let drawW: number, drawH: number;
  if (ir > tr) {
    drawH = ch;
    drawW = drawH * ir;
  } else {
    drawW = cw;
    drawH = drawW / ir;
  }

  const s = Math.max(0.1, Math.min(2, scalePercent / 100));
  drawW *= s;
  drawH *= s;

  const maxOffsetX = drawW - cw;
  const maxOffsetY = drawH - ch;
  const offX = (alignHPercent / 100) * maxOffsetX;
  const offY = (alignVPercent / 100) * maxOffsetY;

  const sx = rect.x - offX;
  const sy = rect.y - offY;

  ctx.drawImage(img, sx, sy, drawW, drawH);
}

/* ========= Component ========= */
export default function Page() {
  // 1) Portrait (remove.bg)
  const [portrait, setPortrait] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [portraitErr, setPortraitErr] = useState<string | null>(null);

  // 2) Logo
  const [logoImg, setLogoImg] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<LogoPos>("top-right");
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [logoScale, setLogoScale] = useState(18);

  // 3) Frame
  const [frameImg, setFrameImg] = useState<string | null>(null);

  // Text
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // 4) Title style
  const [titleFont, setTitleFont] = useState("Montserrat");
  const [titleSize, setTitleSize] = useState(48);
  const [titleAlign, setTitleAlign] = useState<Align>("left");
  const [titleV, setTitleV] = useState(50);
  const [titleH, setTitleH] = useState(60);
  const [titleHex, setTitleHex] = useState("#FFFFFF");

  // 5) Body style
  const [bodyFont, setBodyFont] = useState("Roboto");
  const [bodySize, setBodySize] = useState(16);
  const [bodyAlign, setBodyAlign] = useState<Align>("left");
  const [bodyV, setBodyV] = useState(70);
  const [bodyH, setBodyH] = useState(60);
  const [bodyHex, setBodyHex] = useState("#000000");

  // 6) Background
  const [bgColor, setBgColor] = useState("#e5e7eb");
  const [bgImg, setBgImg] = useState<string | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  // 7) Layout + portrait adjust
  const [layout, setLayout] = useState<LayoutKey>("sym");
  const [portraitH, setPortraitH] = useState(50);
  const [portraitV, setPortraitV] = useState(50);
  const [portraitScale, setPortraitScale] = useState(100);

  const [autoTextByLayout, setAutoTextByLayout] = useState(true);

  const fonts = [
    "Montserrat",
    "Roboto",
    "Oswald",
    "Inter",
    "Be Vietnam Pro",
    "Lato",
    "Open Sans",
    "Source Sans Pro",
    "Playfair Display",
    "Merriweather",
    "Nunito Sans",
    "Quicksand",
  ];
  const swatches = ["#ffffff", "#000000", "#e5e7eb", "#ffc107", "#dc3545", "#17a2b8", "#0ea5e9"];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Auto preset
  function applyTextPresetFor(layoutKey: LayoutKey) {
    switch (layoutKey) {
      case "sym":
        setTitleAlign("left"); setBodyAlign("left");
        setTitleH(60); setBodyH(60);
        setTitleV(35); setBodyV(65);
        break;
      case "asym":
      case "leftTextRightImg":
        setTitleAlign("left"); setBodyAlign("left");
        setTitleH(10); setBodyH(10);
        setTitleV(35); setBodyV(65);
        break;
      case "rightTextLeftImg":
        setTitleAlign("left"); setBodyAlign("left");
        setTitleH(60); setBodyH(60);
        setTitleV(35); setBodyV(65);
        break;
      case "wideTop":
        setTitleAlign("center"); setBodyAlign("center");
        setTitleH(8); setBodyH(8);
        setTitleV(65); setBodyV(80);
        break;
      case "wideBottom":
        setTitleAlign("center"); setBodyAlign("center");
        setTitleH(8); setBodyH(8);
        setTitleV(28); setBodyV(42);
        break;
      case "centerPortrait":
        setTitleAlign("center"); setBodyAlign("center");
        setTitleH(8); setBodyH(8);
        setTitleV(20); setBodyV(88);
        break;
      case "quadTopLeft":
        setTitleAlign("left"); setBodyAlign("left");
        setTitleH(60); setBodyH(60);
        setTitleV(35); setBodyV(65);
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (autoTextByLayout) applyTextPresetFor(layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, autoTextByLayout]);

  /* ========= Upload ========= */
  function onPick(file: File | undefined, setter: (v: string) => void) {
    if (!file || !file.type.startsWith("image/")) return;
    setter(URL.createObjectURL(file));
  }

  async function onPickPortraitRemoveBG(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setPortraitErr(null);
    setPortraitLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file, file.name || "portrait.jpg");

      const res = await fetch("/api/removebg", { method: "POST", body: fd });

      if (!res.ok) {
        const blobUrl = URL.createObjectURL(file);
        setPortrait(blobUrl);
        const text = await res.text();
        setPortraitErr(text || `HTTP ${res.status}`);
        return;
      }

      const pngBlob = await res.blob();
      const url = URL.createObjectURL(pngBlob);
      setPortrait(url);
    } catch (err: any) {
      const blobUrl = URL.createObjectURL(file);
      setPortrait(blobUrl);
      setPortraitErr(err?.message || "RemoveBG failed - hiển thị tạm ảnh gốc");
    } finally {
      setPortraitLoading(false);
    }
  }

  /* ========= Compose ========= */
  const composeTicket = useRef(0);

  async function compose() {
    const ticket = ++composeTicket.current;
    const size = 1024;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    c.width = size;
    c.height = size;

    const [bgEl, portraitEl, frameEl, logoEl] = await Promise.all([
      bgImg ? loadImage(bgImg).catch(() => null) : Promise.resolve(null),
      portrait ? loadImage(portrait).catch(() => null) : Promise.resolve(null),
      frameImg ? loadImage(frameImg).catch(() => null) : Promise.resolve(null),
      logoImg ? loadImage(logoImg).catch(() => null) : Promise.resolve(null),
    ]);

    if (ticket !== composeTicket.current) return;

    // BG
    if (bgEl) {
      const ir = bgEl.width / bgEl.height;
      const tr = 1;
      let sx = 0, sy = 0, sw = bgEl.width, sh = bgEl.height;
      if (ir > tr) {
        sh = bgEl.height; sw = sh * tr; sx = (bgEl.width - sw) / 2;
      } else {
        sw = bgEl.width; sh = sw / tr; sy = (bgEl.height - sh) / 2;
      }
      ctx.drawImage(bgEl, sx, sy, sw, sh, 0, 0, size, size);
      if (overlayOn) {
        ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
        ctx.fillRect(0, 0, size, size);
      }
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    // Portrait
    if (portraitEl) {
      const baseRect = getPortraitBaseRect(layout, size);
      drawCoverImage(ctx, portraitEl, baseRect, portraitH, portraitV, portraitScale);
    }

    // Frame
    if (frameEl) ctx.drawImage(frameEl, 0, 0, size, size);

    // Logo
    if (logoEl) {
      const w = Math.floor((logoScale / 100) * size);
      const h = Math.floor((logoEl.height / logoEl.width) * w);
      let x = 24, y = 24;
      if (logoPos === "top-right") x = size - w - 24;
      if (logoPos === "watermark") { x = size - w - 24; y = size - h - 24; }
      ctx.globalAlpha = logoOpacity;
      ctx.drawImage(logoEl, x, y, w, h);
      ctx.globalAlpha = 1;
    }

    // TEXT
    ctx.textBaseline = "top";

    // Title
    if (title.trim()) {
      ctx.fillStyle = titleHex;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      const blockW = Math.floor(size * 0.84);
      const x = Math.floor((size - blockW) * (titleH / 100));
      const y = Math.floor(size * (titleV / 100));
      ctx.textAlign = titleAlign;
      const safeSize = Math.max(12, Math.min(160, titleSize));
      ctx.font = `bold ${safeSize}px ${titleFont}, system-ui, -apple-system, Segoe UI, Arial`;
      drawWrappedText(ctx, title, x, y, blockW, safeSize * 1.15, titleAlign);
    }

    // Body
    if (body.trim()) {
      ctx.fillStyle = bodyHex;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      const blockW = Math.floor(size * 0.84);
      const x = Math.floor((size - blockW) * (bodyH / 100));
      const y = Math.floor(size * (bodyV / 100));
      ctx.textAlign = bodyAlign;
      const safeSize = Math.max(10, Math.min(80, bodySize));
      ctx.font = `500 ${safeSize}px ${bodyFont}, system-ui, -apple-system, Segoe UI, Arial`;
      drawWrappedText(ctx, body, x, y, blockW, safeSize * 1.2, bodyAlign);
    }

    if (ticket === composeTicket.current) {
      setPreviewUrl(c.toDataURL("image/jpeg", 0.92));
    }
  }

  const rAF = useRef<number | null>(null);
  function scheduleCompose() {
    if (rAF.current) cancelAnimationFrame(rAF.current);
    rAF.current = requestAnimationFrame(() => {
      compose().catch(console.error);
    });
  }

  useEffect(() => {
    scheduleCompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    portrait,
    bgImg,
    frameImg,
    logoImg,
    title,
    body,
    titleFont,
    titleSize,
    titleAlign,
    titleV,
    titleH,
    bodyFont,
    bodySize,
    bodyAlign,
    bodyV,
    bodyH,
    bgColor,
    overlayOn,
    overlayOpacity,
    logoPos,
    logoOpacity,
    logoScale,
    titleHex,
    bodyHex,
    layout,
    portraitH,
    portraitV,
    portraitScale,
  ]);

  /* ========= UI ========= */
  return (
    <div className="min-h-screen bg-[#0f1a19] text-gray-100">
      <header className="border-b border-[#233c48] bg-[#111c22]">
        <div className="mx-auto max-w-[1200px] px-5 h-12 flex items-center justify-between">
          <div className="text-sm font-semibold">Trình tạo ảnh quảng cáo</div>
          <button className="h-8 rounded-lg bg-[#13a4ec] px-3 text-xs font-bold text-white">Đăng nhập</button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT */}
          <section className="lg:col-span-6 space-y-5">
            {/* 1. Portrait */}
            <div>
              <label className="block text-sm font-medium mb-2">1. Tải ảnh chân dung (tự tách nền)</label>
              <div className="rounded-lg border-2 border-dashed border-[#2b4250] bg-[#111c22] p-4">
                <div className="flex items-center gap-3">
                  <label className="h-8 px-4 rounded bg-[#233c48] hover:bg-[#2d4760] text-xs font-semibold cursor-pointer flex items-center">
                    Tải ảnh lên
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onClick={(e) => ((e.target as HTMLInputElement).value = "")}
                      onChange={(e) => onPickPortraitRemoveBG(e.target.files?.[0])}
                      disabled={portraitLoading}
                    />
                  </label>
                  {portraitLoading && !portrait && <span className="text-xs text-yellow-300">Đang tách nền...</span>}
                  {portrait && <span className="text-[11px] text-green-300">Đã tách nền ✓</span>}
                  {portraitErr && <span className="text-xs text-red-400">Lỗi: {portraitErr}</span>}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-gray-400">Căn dọc</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={portraitV}
                      onChange={(e) => setPortraitV(Number(e.target.value))}
                      className="accent-[#13a4ec] w-full"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-20 text-gray-400">Căn ngang</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={portraitH}
                      onChange={(e) => setPortraitH(Number(e.target.value))}
                      className="accent-[#13a4ec] w-full"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-gray-400">Scale</span>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      value={portraitScale}
                      onChange={(e) => setPortraitScale(Number(e.target.value))}
                      className="accent-[#13a4ec] w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Logo */}
            <div>
              <label className="block text-sm font-medium mb-2">2. Logo</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="h-8 px-4 rounded bg-[#233c48] hover:bg-[#2d4760] text-xs font-semibold cursor-pointer flex items-center">
                  Tải logo lên
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0], (v) => setLogoImg(v))}
                  />
                </label>

                <select
                  className="h-8 rounded border border-[#2a4150] bg-[#0f1a20] px-2 text-xs"
                  value={logoPos}
                  onChange={(e) => setLogoPos(e.target.value as LogoPos)}
                >
                  <option value="top-left">Góc trên trái</option>
                  <option value="top-right">Góc trên phải</option>
                  <option value="watermark">Watermark</option>
                </select>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Độ mờ</span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={Math.round(logoOpacity * 100)}
                    onChange={(e) => setLogoOpacity(Number(e.target.value) / 100)}
                    className="accent-[#13a4ec] w-40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Kích cỡ</span>
                  <input
                    type="range"
                    min={8}
                    max={30}
                    value={logoScale}
                    onChange={(e) => setLogoScale(Number(e.target.value))}
                    className="accent-[#13a4ec] w-40"
                  />
                </div>

                {logoImg && <span className="text-[11px] text-green-300">Đã chọn logo ✓</span>}
              </div>
            </div>

            {/* 3. Khung viền */}
            <div>
              <label className="block text-sm font-medium mb-2">3. Khung viền</label>
              <div className="flex items-center gap-3">
                <label className="h-8 px-4 rounded bg-[#233c48] hover:bg-[#2d4760] text-xs font-semibold cursor-pointer flex items-center">
                  Tải khung viền lên
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0], (v) => setFrameImg(v))}
                  />
                </label>
                {frameImg && <span className="text-[11px] text-green-300">Đã chọn khung ✓</span>}
              </div>
            </div>

            {/* 4. Tiêu đề */}
            <div className="rounded-lg border border-[#2a4150] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">4. Tiêu đề</span>
                <div className="flex gap-2">
                  {(["left", "center", "right"] as Align[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setTitleAlign(a)}
                      className={`h-8 px-3 rounded border text-xs ${
                        titleAlign === a ? "border-[#13a4ec] bg-[#0f2835]" : "border-[#2a4150]"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* ô nhập text */}
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[#2a4150] bg-[#0f1a20] px-3 py-2 text-sm mb-3"
                placeholder="Tiêu đề chính"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {/* thanh công cụ */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <select
                  className="h-9 rounded-lg border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                  value={titleFont}
                  onChange={(e) => setTitleFont(e.target.value)}
                >
                  {fonts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                  value={titleSize}
                  onChange={(e) => setTitleSize(Number(e.target.value || 0))}
                />
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-400">Căn dọc</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={titleV}
                    onChange={(e) => setTitleV(Number(e.target.value))}
                    className="accent-[#13a4ec] w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-400">Căn ngang</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={titleH}
                    onChange={(e) => setTitleH(Number(e.target.value))}
                    className="accent-[#13a4ec] w-full"
                  />
                </div>
              </div>

              <div className="border-t border-[#203544] pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className="w-36 h-8 rounded border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                    value={titleHex}
                    onChange={(e) => setTitleHex(e.target.value)}
                    placeholder="#RRGGBB"
                  />
                  <div className="h-6 w-6 rounded border border-gray-500" style={{ background: titleHex }} />
                  <div className="flex items-center gap-2 ml-2">
                    {["#FFFFFF", "#000000", "#13a4ec", "#dc3545", "#ffc107"].map((c) => (
                      <button
                        key={c}
                        className={`h-5 w-5 rounded-full border-2 ${
                          titleHex === c ? "border-white" : "border-gray-500"
                        }`}
                        style={{ background: c }}
                        onClick={() => setTitleHex(c)}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Nội dung */}
            <div className="rounded-lg border border-[#2a4150] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">5. Nội dung</span>
                <div className="flex gap-2">
                  {(["left", "center", "right"] as Align[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setBodyAlign(a)}
                      className={`h-8 px-3 rounded border text-xs ${
                        bodyAlign === a ? "border-[#13a4ec] bg-[#0f2835]" : "border-[#2a4150]"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* ô nhập text */}
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[#2a4150] bg-[#0f1a20] px-3 py-2 text-sm mb-3"
                placeholder="Văn bản phụ (không bắt buộc)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />

              {/* thanh công cụ */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <select
                  className="h-9 rounded-lg border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                >
                  {fonts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                  value={bodySize}
                  onChange={(e) => setBodySize(Number(e.target.value || 0))}
                />
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-400">Căn dọc</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bodyV}
                    onChange={(e) => setBodyV(Number(e.target.value))}
                    className="accent-[#13a4ec] w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-400">Căn ngang</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bodyH}
                    onChange={(e) => setBodyH(Number(e.target.value))}
                    className="accent-[#13a4ec] w-full"
                  />
                </div>
              </div>

              <div className="border-t border-[#203544] pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className="w-36 h-8 rounded border border-[#2a4150] bg-[#0f1a20] px-2 text-sm"
                    value={bodyHex}
                    onChange={(e) => setBodyHex(e.target.value)}
                    placeholder="#RRGGBB"
                  />
                  <div className="h-6 w-6 rounded border border-gray-500" style={{ background: bodyHex }} />
                  <div className="flex items-center gap-2 ml-2">
                    {["#FFFFFF", "#000000", "#13a4ec", "#dc3545", "#ffc107"].map((c) => (
                      <button
                        key={c}
                        className={`h-5 w-5 rounded-full border-2 ${
                          bodyHex === c ? "border-white" : "border-gray-500"
                        }`}
                        style={{ background: c }}
                        onClick={() => setBodyHex(c)}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Nền */}
            <div className="rounded-lg border border-[#2a4150] p-3">
              <p className="font-semibold mb-2">6. Nền</p>
              <div className="flex flex-wrap items-center gap-2">
                {swatches.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded-full border-2 ${
                      bgColor === c ? "border-white" : "border-gray-500"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setBgImg(null);
                      setBgColor(c);
                    }}
                    title={c}
                  />
                ))}
                <label className="h-8 px-3 rounded bg-[#233c48] hover:bg-[#2d4760] text-xs font-semibold cursor-pointer flex items-center ml-3">
                  Ảnh nền
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0], (v) => setBgImg(v))}
                  />
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-300">Bật lớp phủ (overlay)</span>
                  <button
                    type="button"
                    onClick={() => setOverlayOn(!overlayOn)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      overlayOn ? "bg-[#13a4ec]" : "bg-gray-500/40"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        overlayOn ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
              {overlayOn && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-24">
                    Độ mờ: {Math.round(overlayOpacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                    className="accent-[#13a4ec] w-full"
                  />
                </div>
              )}
            </div>

            {/* 7. Bố cục */}
            <div className="rounded-lg border border-[#2a4150] p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">7. Bố cục</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Auto vị trí text</span>
                  <button
                    type="button"
                    onClick={() => setAutoTextByLayout(!autoTextByLayout)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      autoTextByLayout ? "bg-[#13a4ec]" : "bg-gray-500/40"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        autoTextByLayout ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                  <button
                    className="ml-2 h-7 px-2 rounded border border-[#2a4150] text-[11px]"
                    onClick={() => applyTextPresetFor(layout)}
                    title="Áp dụng lại preset vị trí text"
                  >
                    Áp dụng lại
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { key: "sym", label: "Đối xứng trái ảnh – phải chữ" },
                    { key: "asym", label: "Bất đối xứng (ảnh phải lớn)" },
                    { key: "wideTop", label: "Ảnh nửa trên" },
                    { key: "wideBottom", label: "Ảnh nửa dưới" },
                    { key: "leftTextRightImg", label: "Trái chữ – phải ảnh" },
                    { key: "rightTextLeftImg", label: "Trái ảnh – phải chữ" },
                    { key: "centerPortrait", label: "Ảnh giữa" },
                    { key: "quadTopLeft", label: "Ô góc trên trái" },
                  ] as { key: LayoutKey; label: string }[]
                ).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setLayout(o.key)}
                    className={`px-3 h-8 rounded border text-xs ${
                      layout === o.key ? "border-[#13a4ec] bg-[#0f2835]" : "border-[#2a4150]"
                    }`}
                    title={o.label}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-gray-400 mt-2">
                Dùng thanh Căn dọc/Căn ngang/Scale ở mục 1 để tinh chỉnh ảnh chân dung trong bố cục.
              </p>
            </div>
          </section>

          {/* RIGHT */}
          <section className="lg:col-span-6">
            <h3 className="text-sm font-semibold mb-2">Kết quả</h3>
            <div className="rounded-xl bg-gray-300/30 border border-[#2a4150] aspect-square w-full overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full"></canvas>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => compose()}
                className="h-9 rounded-lg bg-[#13a4ec] px-4 text-sm font-bold text-white hover:bg-[#1298da]"
              >
                Tạo ảnh
              </button>
              <button
                onClick={() => {
                  if (!previewUrl) return;
                  const a = document.createElement("a");
                  a.href = previewUrl;
                  a.download = "ad.jpg";
                  a.click();
                }}
                className="h-9 rounded-lg bg-[#233c48] px-4 text-sm font-bold hover:bg-[#2d4760]"
              >
                Tải xuống
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
