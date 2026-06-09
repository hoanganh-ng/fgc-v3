import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/pages/page-shell";

export function NotFoundPage(): JSX.Element {
  return (
    <PageShell eyebrow="404" title="Route Not Found">
      <Card>
        <CardHeader>
          <CardTitle>The requested route is not in this dashboard.</CardTitle>
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
