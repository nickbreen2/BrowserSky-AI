"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/ui/header-2";
import { HeroWithMockup } from "@/components/ui/hero-with-mockup";
import { InfiniteGridBg } from "@/components/ui/infinite-grid-bg";

const faqs = [
  {
    question: "What is BrowserSky AI?",
    answer:
      "BrowserSky AI is a Chrome extension that lets you chat with any web page using AI. Ask questions, get summaries, and extract insights — all without leaving your current tab.",
  },
  {
    question: "Which browsers are supported?",
    answer:
      "BrowserSky AI is currently available for Google Chrome. Support for additional browsers is on our roadmap.",
  },
  {
    question: "Is my browsing data private?",
    answer:
      "Yes. We only process the content of pages you explicitly interact with. Your data is never sold or shared with third parties.",
  },
  {
    question: "Do I need an account to use it?",
    answer:
      "A free account is required to get started. Sign up takes under a minute and unlocks your daily message allowance.",
  },
  {
    question: "What AI model powers BrowserSky?",
    answer:
      "BrowserSky AI is powered by Claude, Anthropic's frontier AI model, known for its accuracy and safety.",
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <h2 className="text-3xl font-bold text-center mb-10 text-foreground">
        Frequently Asked Questions
      </h2>
      <div className="flex flex-col gap-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between px-6 py-4 text-left text-foreground font-medium text-base focus:outline-none"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
            >
              <span>{faq.question}</span>
              <span className="ml-4 text-xl text-blue-500 select-none">
                {openIndex === i ? "−" : "+"}
              </span>
            </button>
            {openIndex === i && (
              <div className="px-6 pb-5 text-foreground/60 text-sm leading-relaxed">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  const links = [
    { label: "How to set up", href: "/how-to-set-up" },
    { label: "FAQ", href: "/faq" },
    { label: "Pricing", href: "/pricing" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ];

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="w-full px-8 py-10 flex items-center justify-between">
        <Link href="/">
          <Image
            src="/icons/Browsersky-1.svg"
            alt="BrowserSky"
            width={120}
            height={20}
            className="h-5 w-auto"
          />
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-foreground/50 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-foreground/40">
          © {new Date().getFullYear()} BrowserSky AI
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Fade to white at bottom */}
      <div
        className="absolute bottom-0 left-0 w-full h-[40vh] -z-10"
        style={{
          background: "linear-gradient(to bottom, transparent, white)",
        }}
      />
      {/* Grid covers header + main, not footer */}
      <div className="relative">
        <InfiniteGridBg />
        <Header />
        <main>
          <HeroWithMockup
            title={"Chat with Any\nWeb Page, Instantly"}
            description="BrowserSky AI brings intelligent AI conversations to every tab. Ask questions, summarize pages, and get instant answers — without leaving your browser."
            primaryCta={{
              text: "Get Extension",
              href: "https://chromewebstore.google.com",
            }}
            mockupImage={{
              src: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1248&h=765&fit=crop",
              alt: "BrowserSky AI Extension Interface",
              width: 1248,
              height: 765,
            }}
          />
          <FAQ />
        </main>
      </div>
      <Footer />
    </div>
  );
}
