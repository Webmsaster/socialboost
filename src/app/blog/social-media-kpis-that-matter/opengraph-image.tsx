import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Social Media KPIs That Actually Matter in 2026";
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
            "linear-gradient(135deg, #0891b2 0%, #164e63 50%, #082f49 100%)",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0891b2",
              fontWeight: 700,
              fontSize: "20px",
            }}
          >
            S
          </div>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "20px" }}>
            SocialBoost Blog
          </span>
        </div>
        <h1
          style={{
            color: "white",
            fontSize: "60px",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Social Media KPIs That Actually Matter in 2026
        </h1>
      </div>
    ),
    { ...size }
  );
}
