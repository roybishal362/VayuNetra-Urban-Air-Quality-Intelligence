import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VayuNetra — Urban Air Quality Intelligence",
  description:
    "Predict, attribute and act on urban air pollution. Monitor → Predict → Attribute → Act.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
