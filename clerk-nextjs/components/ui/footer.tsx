import Image from "next/image";
import Link from "next/link";

const allLinks = [
  { label: "How to set up", href: "/auth-bridge" },
  { label: "FAQ", href: "/#faq" },
  { label: "Pricing", href: "/pricing" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10">

      {/* Mobile (< md) */}
      <div className="md:hidden flex flex-col items-center gap-3 px-6 py-8">
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
          {allLinks.map((link, i) => (
            <span key={link.label} className="flex items-center gap-4">
              <Link href={link.href} className="text-xs text-white/40 hover:text-white transition-colors">
                {link.label}
              </Link>
              {i < allLinks.length - 1 && <span className="text-white/20 text-xs">·</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-white/20 mt-1">© {new Date().getFullYear()} BrowserSky AI</p>
      </div>

      {/* Tablet + Desktop (md+) */}
      <div className="hidden md:flex items-center justify-between w-full px-8 py-8 gap-4">
        <Link href="/" className="shrink-0">
          <Image
            src="/icons/BrowserSky-white-mode.svg"
            alt="BrowserSky"
            width={120}
            height={20}
            className="h-5 w-auto"
          />
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {allLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-white/40 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-white/30 shrink-0 whitespace-nowrap">
          © {new Date().getFullYear()} BrowserSky AI
        </p>
      </div>

    </footer>
  );
}
