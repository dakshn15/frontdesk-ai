"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Playground and Tests, the two halves of the test lab. */
export function TestLabTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/w/${slug}/assistant`;
  const tabs = [
    { label: "Playground", href: base, active: pathname === base },
    {
      label: "Tests",
      href: `${base}/tests`,
      active: pathname !== base && pathname.startsWith(base),
    },
  ];
  return (
    <nav aria-label="Test lab" className="mt-6 flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
