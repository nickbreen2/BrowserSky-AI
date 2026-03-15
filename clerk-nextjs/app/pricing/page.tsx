"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header-2";
import { InfiniteGridBg } from "@/components/ui/infinite-grid-bg";
import { Footer } from "@/components/ui/footer";

const MONTHLY_VARIANT_ID = process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID!;
const ANNUAL_VARIANT_ID = process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID!;

const FREE_FEATURES = [
  "50 credits / day",
  "Budget models only (GPT-4o mini, Grok Mini)",
  "Basic page summarization",
  "Community support",
];

const PRO_FEATURES = [
  "2,000 credits / month",
  "All models (GPT-4o, Claude Sonnet, Grok 3)",
  "Advanced page summarization",
  "Priority support",
  "Early access to new features",
];

export default function PricingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proPrice = billing === "monthly" ? "$20" : "$13";
  const proNote = billing === "annual" ? "Billed annually — $156/yr" : null;
  const variantId = billing === "monthly" ? MONTHLY_VARIANT_ID : ANNUAL_VARIANT_ID;

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId }),
      });

      if (res.status === 401) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent("/pricing")}`);
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Failed to create checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col text-white font-[family-name:var(--font-gelasio)]" style={{ background: "#0f1f27" }}>
      <div className="relative flex-1">
        <InfiniteGridBg />
        <Header />

      <main className="relative z-10 flex flex-col items-center px-4 pt-26 md:pt-36 pb-24">
        {/* Heading */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-white/60 text-center text-base md:text-lg mb-10 max-w-xl">
          Start for free. Upgrade when you&apos;re ready for more.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 mb-10">
          <button
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
              billing === "monthly"
                ? "bg-white text-gray-900 shadow"
                : "text-white/60 hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
              billing === "annual"
                ? "bg-white text-gray-900 shadow"
                : "text-white/60 hover:text-white"
            }`}
          >
            Annual
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              billing === "annual" ? "bg-green-500 text-white" : "bg-green-500/20 text-green-400"
            }`}>
              35% OFF
            </span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-6 text-red-400 text-sm text-center">{error}</p>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-xl font-semibold mb-1">Free</h2>
            <p className="text-white/50 text-sm mb-4">Get started at no cost.</p>
            <div className="text-4xl font-bold mb-1">$0</div>
            <p className="text-white/40 text-sm mb-6">/ month</p>
            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full rounded-xl py-3 text-sm font-semibold bg-white/5 text-white/30 cursor-default"
            >
              Current plan
            </button>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-2xl border border-blue-400/60 bg-blue-500/10 p-8 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-4 py-0.5 text-xs font-semibold text-white shadow">
              Most Popular
            </span>
            <h2 className="text-xl font-semibold mb-1">Pro</h2>
            <p className="text-white/50 text-sm mb-4">Unlock everything.</p>
            <div className="flex items-end gap-2 mb-1">
              {billing === "annual" && (
                <span className="text-white/40 line-through text-2xl font-semibold">$20</span>
              )}
              <span className="text-4xl font-bold">{proPrice}</span>
            </div>
            <p className="text-white/40 text-sm mb-1">/ month</p>
            {proNote && (
              <p className="text-green-400 text-xs font-medium mb-5">{proNote}</p>
            )}
            {!proNote && <div className="mb-5" />}
            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold bg-gradient-to-b from-blue-400 to-blue-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : `Subscribe ${billing === "annual" ? "Annually" : "Monthly"}`}
            </button>
          </div>

        </div>
      </main>
      </div>
      <Footer />
    </div>
  );
}
