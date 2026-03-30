import type { Metadata } from "next";
import { Providers } from "@/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONFLICT.GAME",
  description: "Geopolitical MMO Strategy Game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary min-h-screen overflow-hidden antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
