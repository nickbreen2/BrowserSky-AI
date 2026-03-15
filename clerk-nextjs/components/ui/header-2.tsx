'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { GlowButton } from '@/components/ui/glow-button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';


export function Header() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const links = [
    { label: 'How to set up', href: '/auth-bridge' },
    { label: 'FAQ', href: '/#faq', scrollTo: 'faq' },
    { label: 'Pricing', href: '/pricing' },
  ];

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, scrollTo?: string) {
    if (!scrollTo) return;
    const el = document.getElementById(scrollTo);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header className="fixed left-0 right-0 z-50 flex justify-center px-4" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
      <nav className="relative flex h-14 w-full max-w-3xl items-center rounded-full border border-white/20 bg-[#15313D]/88 px-6 shadow-lg backdrop-blur-xl text-white font-[family-name:var(--font-gelasio)]">
        {/* Logo — left */}
        <Link href="/" className="flex items-center">
          <Image
            src="/icons/BrowserSky-white-mode.svg"
            alt="Browsersky"
            width={140}
            height={22}
            priority
            className="h-6 w-auto"
          />
        </Link>

        {/* Desktop nav — absolutely centered */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {links.map((link) => {
            const isActive = link.href === pathname;
            return (
              <Link
                key={link.label}
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'text-white hover:text-white hover:bg-white/10',
                  isActive && 'bg-white/15 font-semibold',
                )}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.scrollTo)}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop CTA — right */}
        <div className="ml-auto hidden md:block">
          <GlowButton
            href="https://chromewebstore.google.com"
            label="Get Extension"
            target="_blank"
            rel="noopener noreferrer"
          />
        </div>

        {/* Mobile menu toggle */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(!open)}
          className="ml-auto md:hidden text-white hover:bg-white/10 hover:text-white"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          'bg-[#0f1f27]/95 backdrop-blur-xl fixed top-20 right-4 left-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-lg md:hidden font-[family-name:var(--font-gelasio)]',
          open ? 'block' : 'hidden',
        )}
      >
        <div
          data-slot={open ? 'open' : 'closed'}
          className={cn(
            'data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out',
            'flex h-full w-full flex-col justify-between gap-y-2 p-4',
          )}
        >
          <div className="grid gap-y-2">
            {links.map((link) => (
              <Link
                key={link.label}
                className={buttonVariants({ variant: 'ghost', className: 'justify-start text-white hover:bg-white/10 hover:text-white' })}
                href={link.href}
                onClick={(e) => { handleNavClick(e, link.scrollTo); setOpen(false); }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <GlowButton
              href="https://chromewebstore.google.com"
              label="Get Extension"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full justify-center"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
