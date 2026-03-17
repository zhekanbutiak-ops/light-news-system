import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #141414 100%)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 900,
            letterSpacing: -6,
            background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
            color: "transparent",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
            lineHeight: 1,
          }}
        >
          LN
        </div>
      </div>
    ),
    size
  );
}

