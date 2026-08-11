import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenderAI",
  description: "Tender intelligence and compliance operations platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="it"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
