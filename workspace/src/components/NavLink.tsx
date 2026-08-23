"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={clsx(
        "rounded px-2 py-1 text-sm transition-colors",
        active ? "text-ink" : "text-faint hover:text-muted",
      )}
    >
      {children}
    </Link>
  );
}
