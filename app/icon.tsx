import { ImageResponse } from "next/og";
import { brandImageData } from "../lib/brand-assets";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export default async function Icon() {
  const symbol = await brandImageData("symbol");
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><img src={symbol} width={64} height={64} alt="" /></div>, size);
}
