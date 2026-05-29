import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "../dashboard/AppNav";

// "Signal" type system (frontend-design pass): a characterful display grotesque, an
// engineering-console monospace for data readouts, and a clean grotesk for prose.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HackerRank Support Triage Console",
  description: "AI-assisted triage for HackerRank support tickets — queue, decision, sources, justification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="flex h-screen overflow-hidden">
        <AppNav />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
