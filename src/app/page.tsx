import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-md space-y-3 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
          TenderAI
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Tender intelligence, con confini sicuri.</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Accedi al tuo workspace o crea il primo account TenderAI.
        </p>
        <div className="flex justify-center gap-3 pt-3">
          <Link className={cn(buttonVariants())} href="/login">Accedi</Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} href="/signup">Registrati</Link>
        </div>
      </section>
    </main>
  );
}
