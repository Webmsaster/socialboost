import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SocialBoost — AI Social Media Post Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: 800,
              color: "#6366f1",
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: "white",
            }}
          >
            SocialBoost
          </span>
        </div>
        <p
          style={{
            fontSize: "28px",
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          AI-Powered Social Media Posts for LinkedIn, Facebook, Instagram, Pinterest & X
        </p>
      </div>
    ),
    { ...size }
  );
}
