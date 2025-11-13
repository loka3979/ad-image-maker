// src/lib/composeAd.ts

// CHÚ Ý: file này chạy trên server. Tránh xung đột type với DOM.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – node-canvas types có thể xung đột DOM; ignore là an toàn cho server
import { createCanvas, loadImage } from "canvas";

type PNGBuffer = Buffer;

// … code khác của bạn …

// ví dụ đoạn convert Buffer -> Image
async function bufferToImage(buf: PNGBuffer) {
  // TS đôi khi coi tham số của loadImage là ImageSource (trong DOM).
  // Ép kiểu any để dùng chuẩn node-canvas:
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return await loadImage(buf as any);
}
