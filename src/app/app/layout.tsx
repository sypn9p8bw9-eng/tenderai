import type { ReactNode } from "react";

import { requireAuthenticatedUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();

  return <div className="min-h-screen bg-[#f6f7f9]">{children}</div>;
}
