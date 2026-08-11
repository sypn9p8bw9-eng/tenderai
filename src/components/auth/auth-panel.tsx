import type { ReactNode } from "react";

type AuthPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthPanel({ title, description, children, footer }: AuthPanelProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            TenderAI
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer ? (
          <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function AuthNotice({ children, tone = "neutral" }: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "mb-5 rounded-lg border bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {children}
    </div>
  );
}

export const authInputClassName =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20";
