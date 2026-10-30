import { ImageResponse } from "next/og";
import { brandImageData } from "../lib/brand-assets";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default async function AppleIcon() {
  const symbol = await brandImageData("symbol");
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102c3e" }}><img src={symbol} width={164} height={164} alt="" /></div>, size);
}
