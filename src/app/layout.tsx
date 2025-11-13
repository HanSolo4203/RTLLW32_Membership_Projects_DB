import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar, MobileNav } from "@/components/layout/AppSidebar";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import AppToaster from "@/components/ui/sonner-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard | RTL32 Attendance",
  description: "Real-time membership analytics for Round Table Lilongwe 32.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <div className="flex min-h-screen bg-slate-100 text-slate-900">
            <AppSidebar />
            <div className="flex min-h-screen flex-1 flex-col">
              <div className="flex-1 pb-20 lg:pb-0">{children}</div>
              <MobileNav />
            </div>
          </div>
        </ReactQueryProvider>
        <AppToaster />
      </body>
    </html>
  );
}
