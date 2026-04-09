import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "How to Make AI-Generated Content Sound Like You";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #10b981 0%, #047857 50%, #064e3b 100%)",
          padding: "60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div
            style={{
              width: "40px", height: "40px", borderRadius: "8px",
              background: "white", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#10b981", fontWeight: 700, fontSize: "20px",
            }}
          >S</div>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "20px" }}>
            SocialBoost Blog
          </span>
        </div>
        <h1 style={{ color: "white", fontSize: "60px", fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
          How to Make AI-Generated Content Sound Like You
        </h1>
      </div>
    ),
    { ...size }
  );
}
