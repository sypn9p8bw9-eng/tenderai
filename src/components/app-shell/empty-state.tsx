import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyState({ icon, eyebrow, title, description, children }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-muted text-primary">
        {icon}
      </div>
      <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      <h1 className="mx-auto mt-2 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-7 flex justify-center">{children}</div> : null}
    </section>
  );
}
