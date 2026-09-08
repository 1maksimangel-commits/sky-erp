import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKY ERP",
  description: "Modern enterprise resource planning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
