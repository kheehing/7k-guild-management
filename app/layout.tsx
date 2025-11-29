// app/layout.tsx — SERVER COMPONENT
import "./globals.css"; // Tailwind
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Ap0theosis",
  description: "Guild management",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  openGraph: {
    title: "Ap0theosis",
    description: "Guild management",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
