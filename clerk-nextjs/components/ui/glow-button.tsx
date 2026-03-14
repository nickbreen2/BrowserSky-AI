import Image from 'next/image';

interface GlowButtonProps {
  href: string;
  label: string;
  target?: string;
  rel?: string;
  className?: string;
  size?: 'sm' | 'lg';
}

export function GlowButton({
  href,
  label,
  target,
  rel,
  className,
  size = 'sm',
}: GlowButtonProps) {
  if (size === 'lg') {
    return (
      <div className={`relative inline-flex items-center justify-center group ${className ?? ""}`}>
        {/* Soft glow shadow beneath */}
        <div className="absolute bottom-[-10px] left-[10%] right-[10%] h-6 bg-blue-400/50 blur-xl rounded-full" />
        <a
          role="button"
          href={href}
          target={target}
          rel={rel}
          className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-400 to-blue-500 px-8 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_16px_rgba(59,130,246,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(59,130,246,0.5)]"
        >
          <Image src="/icons/chrome-logo.svg" alt="Chrome" width={20} height={20} />
          {label}
        </a>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center gap-4 group ${className ?? ""}`}>
      <div className="absolute inset-0 duration-1000 opacity-60 transition-all bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 rounded-full blur-lg filter group-hover:opacity-100 group-hover:duration-200" />
      <a
        role="button"
        className="group relative inline-flex items-center justify-center rounded-full bg-white font-semibold text-gray-900 transition-all duration-200 hover:bg-gray-50 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-gray-400/30 px-6 py-2 text-sm"
        href={href}
        target={target}
        rel={rel}
      >
        {label}
        <svg
          viewBox="0 0 10 10"
          height="10"
          width="10"
          fill="none"
          className="mt-0.5 ml-2 -mr-1 stroke-gray-900 stroke-2"
        >
          <path
            d="M0 5h7"
            className="transition opacity-0 group-hover:opacity-100"
          />
          <path
            d="M1 1l4 4-4 4"
            className="transition group-hover:translate-x-[3px]"
          />
        </svg>
      </a>
    </div>
  );
}
