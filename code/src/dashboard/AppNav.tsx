"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App navigation rail (D12). The product is no longer a single screen: the live Triage
 * Console is the monitoring surface; Review (B1) and Accuracy add verify/drill-in/trust.
 * A slim icon rail switches between them and stays out of the console's way.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Console",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9l3 3-3 3M13 15h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/review",
    label: "Review",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M4 5h16v10H7l-3 3V5z" strokeLinejoin="round" />
        <path d="M9 10h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/accuracy",
    label: "Accuracy",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M4 20V4M4 20h16" strokeLinecap="round" />
        <path d="M8 16l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="glass z-10 flex w-14 shrink-0 flex-col items-center gap-1 border-r border-hr-border py-3"
    >
      <span className="mb-3 grid h-8 w-8 place-items-center rounded-md bg-hr-green font-mono text-sm font-bold text-black shadow-[0_0_16px_-2px_var(--hr-green)]">
        {">"}
      </span>
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={`group relative grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
              active
                ? "border-hr-green/40 bg-hr-green/[0.08] text-hr-green-bright"
                : "border-transparent text-hr-muted hover:border-hr-border hover:text-foreground"
            }`}
          >
            {active && (
              <span className="absolute -left-3 h-5 w-[3px] rounded-full bg-hr-green-bright shadow-[0_0_6px_-1px_var(--hr-green-bright)]" />
            )}
            <span className="h-5 w-5">{item.icon}</span>
          </Link>
        );
      })}
    </nav>
  );
}
