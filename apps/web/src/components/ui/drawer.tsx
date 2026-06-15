import {
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface DrawerProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly closeLabel?: string;
  readonly onClose: (source: DrawerCloseSource) => void;
}

export type DrawerCloseSource = "button" | "escape" | "backdrop";

export function Drawer({
  open,
  title,
  description,
  children,
  className,
  contentClassName,
  closeLabel = "Close drawer",
  onClose,
}: DrawerProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRootRef = useRef<HTMLDivElement | null>(null);
  const drawerPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const drawerRoot = drawerRootRef.current;
    if (drawerRoot === null) {
      return;
    }

    const bodyChildren = Array.from(document.body.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child !== drawerRoot,
    );
    const previousStates = bodyChildren.map((child) => ({
      child,
      inert: child.inert,
      ariaHidden: child.getAttribute("aria-hidden"),
    }));

    for (const child of bodyChildren) {
      child.inert = true;
      child.setAttribute("aria-hidden", "true");
    }

    return () => {
      for (const { child, inert, ariaHidden } of previousStates) {
        child.inert = inert;
        if (ariaHidden === null) {
          child.removeAttribute("aria-hidden");
        } else {
          child.setAttribute("aria-hidden", ariaHidden);
        }
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose("escape");
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function containFocus(event: FocusEvent): void {
      const drawerPanel = drawerPanelRef.current;
      if (
        drawerPanel === null ||
        event.target === null ||
        drawerPanel.contains(event.target as Node)
      ) {
        return;
      }

      focusFirstDrawerElement(drawerPanel);
    }

    document.addEventListener("focusin", containFocus);

    return () => {
      document.removeEventListener("focusin", containFocus);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const drawer = (
    <div ref={drawerRootRef} className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer backdrop"
        className="absolute inset-0 block size-full cursor-default bg-black/35"
        type="button"
        onClick={() => {
          onClose("backdrop");
        }}
      />
      <section
        aria-describedby={description !== undefined ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={getDrawerPanelClassName({ className })}
        onKeyDown={trapDrawerTabKey}
        ref={drawerPanelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold leading-6 text-foreground"
              id={titleId}
            >
              {title}
            </h2>
            {description !== undefined ? (
              <p
                className="mt-1 break-words text-sm leading-6 text-muted-foreground"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            ref={closeButtonRef}
            aria-label={closeLabel}
            size="sm"
            variant="ghost"
            onClick={() => {
              onClose("button");
            }}
          >
            <X aria-hidden="true" className="size-4" />
            Close
          </Button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4",
            contentClassName,
          )}
        >
          {children}
        </div>
      </section>
    </div>
  );

  if (typeof document === "undefined") {
    return drawer;
  }

  return createPortal(drawer, document.body);
}

export function getDrawerPanelClassName(
  props: Pick<HTMLAttributes<HTMLElement>, "className"> = {},
): string {
  return cn(
    "absolute right-0 top-0 flex h-dvh w-screen max-w-full flex-col border-l border-border bg-white shadow-2xl sm:w-full sm:max-w-[28rem]",
    props.className,
  );
}

const focusableElementSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "details summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function trapDrawerTabKey(event: ReactKeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableDrawerElements(event.currentTarget);

  if (focusableElements.length === 0) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const finalElement = focusableElements[focusableElements.length - 1];

  if (firstElement === undefined || finalElement === undefined) {
    return;
  }

  if (focusableElements.length === 1) {
    event.preventDefault();
    firstElement.focus();
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    finalElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === finalElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function focusFirstDrawerElement(drawerPanel: HTMLElement): void {
  const firstElement = getFocusableDrawerElements(drawerPanel)[0];

  if (firstElement === undefined) {
    drawerPanel.focus();
    return;
  }

  firstElement.focus();
}

function getFocusableDrawerElements(drawerPanel: HTMLElement): HTMLElement[] {
  return Array.from(
    drawerPanel.querySelectorAll<HTMLElement>(focusableElementSelector),
  ).filter((element) => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return element.offsetParent !== null || element === document.activeElement;
  });
}
