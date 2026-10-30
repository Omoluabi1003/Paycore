import { ImageResponse } from "next/og";
import { brandImageData } from "../lib/brand-assets";

export const alt = "PayCore sculptural logo with a luminous core. Developed by ETL GIS Consulting LLC.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ShareImage() {
  const hero = await brandImageData("hero");
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#07121e" }}>
      <img src={hero} width={1200} height={600} alt="" />
    </div>,
    size,
  );
}
