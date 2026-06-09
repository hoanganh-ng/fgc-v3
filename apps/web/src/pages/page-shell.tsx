import type { ReactNode } from "react";

export interface PageShellProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: PageShellProps): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow !== undefined ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
            {title}
          </h2>
          {description !== undefined ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
