import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

export function buttonVariants(options: {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly className?: string | undefined;
}): string {
  const variant = options.variant ?? "primary";
  const size = options.size ?? "md";

  return cn(
    "inline-flex items-center justify-center gap-2 rounded border font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-55",
    size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm",
    variant === "primary" &&
      "border-primary bg-primary text-primary-foreground hover:bg-[#175d61]",
    variant === "secondary" &&
      "border-border bg-white text-foreground hover:bg-muted",
    variant === "ghost" &&
      "border-transparent bg-transparent text-foreground hover:bg-muted",
    variant === "danger" &&
      "border-[#b93535] bg-[#b93535] text-white hover:bg-[#9f2d2d]",
    options.className,
  );
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      type={type}
      {...props}
    />
  );
}
