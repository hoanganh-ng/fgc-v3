import { Link, useRouteError } from "react-router-dom";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/pages/page-shell";

export function RouteErrorPage(): JSX.Element {
  const routeError = useRouteError();
  const message =
    routeError instanceof Error
      ? routeError.message
      : "The dashboard route could not be rendered.";

  return (
    <PageShell eyebrow="Route Error" title="Dashboard Error">
      <Card>
        <CardHeader>
          <CardTitle>{message}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link className={buttonVariants({ variant: "secondary" })} to="/">
            <Home aria-hidden="true" className="size-4" />
            Dashboard
          </Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}
