import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link className="font-semibold tracking-tight" href="/app">TenderAI</Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutAction}><Button variant="outline" type="submit">Esci</Button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
