import { ImageResponse } from "next/og";

export const alt = "PayCore — Contractor settlements and payroll operations. Developed by ETL GIS Consulting LLC.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ShareImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#102c3e", color: "#f6f8f0", fontFamily: "sans-serif", borderBottom: "12px solid #b4d4a3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="100" height="100" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="19" fill="#16594E" />
          <path fill="#F6F8F0" fillRule="evenodd" d="M20 16h15c9 0 15 5.7 15 14s-6 14-15 14h-6v9h-9V16Zm9 9v10h6c3.9 0 6-1.8 6-5s-2.1-5-6-5h-6Z" clipRule="evenodd" />
          <circle cx="45" cy="49" r="5" fill="#B4D4A3" />
        </svg>
        <span style={{ fontSize: 70, fontWeight: 700, letterSpacing: -3 }}>PayCore</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.12 }}>Contractor settlements.</span>
        <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.12 }}>Confident payroll.</span>
        <span style={{ fontSize: 25, color: "#c5dbd6", marginTop: 6 }}>Enter the facts. Understand every deduction.</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "1px solid #486574", paddingTop: 24 }}>
        <span style={{ fontSize: 21, color: "#c5dbd6" }}>Developed by</span>
        <span style={{ fontSize: 25, fontWeight: 700, color: "#f2d596" }}>ETL GIS Consulting LLC</span>
      </div>
    </div>,
    size,
  );
}
