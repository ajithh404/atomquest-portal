import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "AtomQuest — Goal Setting & Tracking Portal",
  description:
    "In-house goal setting and tracking portal for Atomberg Technologies. Set goals, track quarterly achievements, and drive organizational alignment.",
  keywords: ["goal tracking", "performance management", "OKR", "Atomberg"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${manrope.className}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
  try {
    const theme = localStorage.getItem('atomquest-theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
