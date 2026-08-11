"use client";

import {
  Archive,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "", label: "Panoramica", icon: LayoutDashboard, exact: true },
  { href: "/tenders", label: "Gare", icon: ClipboardList },
  { href: "/evidence", label: "Archivio evidenze", icon: Archive },
  { href: "/tasks", label: "Attività", icon: ListTodo },
  { href: "/team", label: "Team", icon: Users },
];

type WorkspaceNavigationProps = {
  basePath: string;
  variant: "sidebar" | "mobile";
};

export function WorkspaceNavigation({ basePath, variant }: WorkspaceNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione workspace"
      className={cn(
        variant === "sidebar" ? "space-y-1" : "flex min-w-max items-center gap-1 px-4 py-2",
      )}
    >
      {navigation.map((item) => {
        const href = `${basePath}${item.href}`;
        const isActive = item.exact ? pathname === href : pathname.startsWith(href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href || "overview"}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg text-sm font-medium transition",
              variant === "sidebar" ? "w-full px-3 py-2" : "px-3 py-1.5 whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href={href}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
