"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { GlowButton } from "@/components/ui/glow-button";
import { Mockup } from "@/components/ui/mockup";
import { Glow } from "@/components/ui/glow";

interface HeroWithMockupProps {
  title: string;
  description: string;
  primaryCta?: {
    text: string;
    href: string;
  };
mockupImage: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  className?: string;
}


export function HeroWithMockup({
  title,
  description,
  primaryCta = {
    text: "Get Started",
    href: "/sign-up",
  },
  mockupImage,
  className,
}: HeroWithMockupProps) {
  return (
    <section
      className={cn(
        "relative text-foreground",
        "py-4 px-4 md:py-8 lg:py-12",
        "overflow-hidden",
        className,
      )}
    >
      <div className="relative mx-auto max-w-[1280px] flex flex-col gap-12 lg:gap-24">
        <div className="relative z-10 flex flex-col items-center gap-3 pt-22 md:pt-16 text-center lg:gap-4">
          {/* Heading */}
          <h1
            className={cn(
              "block animate-appear",
              "bg-gradient-to-b from-white via-white/90 to-white/60",
              "bg-clip-text text-transparent",
              "text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl",
              "leading-[1.15] sm:leading-[1.15]",
              "drop-shadow-sm",
            )}
          >
            {title.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </h1>

          {/* Description */}
          <p
            className={cn(
              "max-w-[550px] animate-appear [animation-delay:150ms]",
              "text-sm sm:text-base md:text-lg",
              "text-white/60",
              "font-medium",
            )}
          >
            {description}
          </p>

          {/* Brand Logo */}
          <div className="animate-appear [animation-delay:225ms] animate-float mt-6">
            <Image
              src="/icons/Browsersky-full-logo.svg"
              alt="BrowserSky"
              width={1200}
              height={300}
              className="h-40 sm:h-52 md:h-64 w-auto"
            />
          </div>

          {/* CTAs */}
          <div className="relative z-10 flex justify-center animate-appear [animation-delay:300ms] mt-4 md:mt-6">
            <GlowButton href={primaryCta.href} label={primaryCta.text} target="_blank" rel="noopener noreferrer" size="lg" />
          </div>

          {/* Mockup */}
          <div className="relative w-full pt-12 px-4 sm:px-6 lg:px-8">
            <Mockup
              className={cn(
                "animate-appear [animation-delay:700ms]",
                "shadow-[0_0_50px_-12px_rgba(0,0,0,0.3)]",
                "border-blue-500/10",
              )}
            >
              <img
                {...mockupImage}
                className="w-full h-auto"
                loading="lazy"
                decoding="async"
              />
            </Mockup>
          </div>
        </div>
      </div>

      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Glow
          variant="above"
          className="animate-appear-zoom [animation-delay:1000ms]"
        />
      </div>
    </section>
  );
}
