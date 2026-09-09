import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

export const metadata: Metadata = {
  title: "Scrapo — Freelance Lead Hunter",
  description:
    "A focused workspace for high-quality freelance mobile development prospects.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
