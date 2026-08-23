import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocSureInd — Tamil Nadu Scholarship Document Verification Assistant",
  description: "Secure, automated preparation assistant. Fuzzily validates candidate names, certificate expiration, and required documents using Vertex AI Gemini before scholarship submissions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white bg-grid-pattern">
        
        {/* Header navigation bar */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                <span className="text-2xl">🇮🇳</span>
                <span className="font-outfit text-xl font-bold tracking-tight text-slate-900">
                  DocSure<span className="text-indigo-600 font-semibold">Ind</span>
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                <Link href="/check" className="hover:text-indigo-600 transition-colors">
                  Verify Documents
                </Link>
                <Link href="/about" className="hover:text-indigo-600 transition-colors">
                  Scholarship Info
                </Link>
                <Link href="/privacy" className="hover:text-indigo-600 transition-colors">
                  Privacy Policy
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/check"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 hover:shadow-indigo-100 transition-all"
                id="btn-nav-get-started"
              >
                Verify Now
              </Link>
            </div>
          </div>
        </header>

        {/* Core application body */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

        {/* Footer */}
        <footer className="w-full border-t border-slate-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
              <div>
                <p className="font-outfit font-semibold text-slate-900">
                  DocSureInd — Tamil Nadu Scholarship Document Checker
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  An independent tool designed to reduce documentation rejection rates in e-Sevai centers.
                </p>
              </div>
              <div className="flex gap-4 text-xs font-medium text-slate-500">
                <Link href="/about" className="hover:text-indigo-600">
                  Scholarship Rules
                </Link>
                <Link href="/privacy" className="hover:text-indigo-600">
                  Data Safety
                </Link>
                <a
                  href="https://www.tnscholarship.tn.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-indigo-600 underline"
                >
                  Official TN Portal
                </a>
              </div>
            </div>
            <div className="mt-8 border-t border-slate-100 pt-6 text-center text-[10px] text-slate-400">
              Disclaimer: DocSureInd is a preparation helper and does not grant, approve, or guarantee official scholarship approval.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
