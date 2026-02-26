import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  /** Size of the circular logo image in px (default 36) */
  size?: number;
  /** If true, wraps the logo in a Link to "/" */
  linked?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

export function Logo({ size = 36, linked = true, className = '' }: LogoProps) {
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="Avantika Interview AI logo"
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        priority
      />
      <span className="font-extrabold tracking-tight text-white leading-tight">
        Avantika<span className="text-purple-400"> Interview AI</span>
      </span>
    </span>
  );

  return linked ? (
    <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-90 transition">
      {inner}
    </Link>
  ) : (
    inner
  );
}
