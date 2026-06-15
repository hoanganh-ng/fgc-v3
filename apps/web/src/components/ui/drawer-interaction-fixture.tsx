import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

function DrawerInteractionFixture(): JSX.Element {
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (selectedRunId !== undefined || !shouldRestoreFocusRef.current) {
      return;
    }

    shouldRestoreFocusRef.current = false;
    window.requestAnimationFrame(() => {
      openerRef.current?.focus();
    });
  }, [selectedRunId]);

  function openDrawer(
    accountExerciseRunId: string,
    opener: HTMLButtonElement,
  ): void {
    openerRef.current = opener;
    setSelectedRunId(accountExerciseRunId);
  }

  function closeDrawer(): void {
    shouldRestoreFocusRef.current = selectedRunId !== undefined;
    setSelectedRunId(undefined);
  }

  return (
    <main>
      <Button id="background-before" variant="secondary">
        Background Before
      </Button>
      <Button
        id="details-run-1"
        variant={selectedRunId === "run-1" ? "primary" : "secondary"}
        onClick={(event) => {
          openDrawer("run-1", event.currentTarget);
        }}
      >
        Details Run 1
      </Button>
      <Button
        id="details-run-2"
        variant={selectedRunId === "run-2" ? "primary" : "secondary"}
        onClick={(event) => {
          openDrawer("run-2", event.currentTarget);
        }}
      >
        Details Run 2
      </Button>
      <Button
        id="details-run-single"
        variant={selectedRunId === "run-single" ? "primary" : "secondary"}
        onClick={(event) => {
          openDrawer("run-single", event.currentTarget);
        }}
      >
        Details Single Focus
      </Button>
      <Button id="background-after" variant="secondary">
        Background After
      </Button>

      <Drawer
        open={selectedRunId !== undefined}
        title="Run Detail"
        description={selectedRunId}
        closeLabel="Close run detail drawer"
        onClose={closeDrawer}
      >
        {selectedRunId !== "run-single" ? (
          <div className="grid gap-3">
            <Button id="drawer-secondary-action" variant="secondary">
              Secondary Drawer Action
            </Button>
            <Button
              id="drawer-switch-run"
              variant="secondary"
              onClick={() => {
                setSelectedRunId("run-2");
              }}
            >
              Switch Selected Run
            </Button>
          </div>
        ) : null}
      </Drawer>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Drawer interaction fixture root is missing.");
}

createRoot(rootElement).render(<DrawerInteractionFixture />);
