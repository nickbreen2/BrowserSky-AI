"use client";

import Image from "next/image";
import { Header } from "@/components/ui/header-2";
import { Footer } from "@/components/ui/footer";
import { InfiniteGridBg } from "@/components/ui/infinite-grid-bg";
import { useState } from "react";

const SUPPORT_EMAIL = "support@browsersky.dev";

export default function SupportPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="relative min-h-screen flex flex-col font-[family-name:var(--font-gelasio)]"
      style={{ background: "#0f1f27" }}
    >
      <div className="relative flex-1">
        <InfiniteGridBg />
        <Header />
        <main className="flex flex-col items-center justify-center px-6 pt-36 pb-24 text-center">
          <Image
            src="/icons/support.gif"
            alt="Support"
            width={220}
            height={220}
            className="mb-8 rounded-2xl"
            unoptimized
          />

          <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
            Need help?
          </h1>
          <p className="text-white/50 text-base md:text-lg mb-10 max-w-md">
            We&apos;re here for you. Reach out and we&apos;ll get back to you as
            soon as possible.
          </p>

          <div className="flex items-center w-full max-w-sm rounded-xl border border-white/15 bg-white/5 px-4 py-3 gap-3">
            <span className="flex-1 font-mono text-sm text-white text-left">{SUPPORT_EMAIL}</span>
            {/* Open email — arrow pointing out of a box */}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="shrink-0 text-white/40 hover:text-white transition-colors"
              aria-label="Open email"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {/* box */}
                <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
                {/* arrow shaft */}
                <line x1="13" y1="11" x2="21" y2="3" />
                {/* arrowhead */}
                <polyline points="15 3 21 3 21 9" />
              </svg>
            </a>
            {/* Copy — two overlapping squares */}
            <button
              onClick={handleCopy}
              className="shrink-0 text-white/40 hover:text-white transition-colors"
              aria-label="Copy email"
            >
              {copied ? (
                /* Checkmark */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12 9 17 20 6" />
                </svg>
              ) : (
                /* Two stacked squares */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
