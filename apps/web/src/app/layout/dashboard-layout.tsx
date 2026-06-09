import { NavLink, Outlet } from "react-router-dom";
import { primaryNavigation } from "@/app/navigation";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

export function DashboardLayout(): JSX.Element {
  const apiBaseLabel = env.VITE_API_BASE_URL || "same origin";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-b border-border bg-[#222824] text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="grid size-9 place-items-center rounded bg-[#f2b84b] text-sm font-bold text-[#1d231f]">
              FG
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Content Pipeline</p>
              <p className="truncate text-xs text-white/62">Collector Admin</p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
            {primaryNavigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 shrink-0 items-center gap-3 rounded px-3 py-2 text-sm font-medium text-white/70 outline-none transition hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-[#f2b84b]",
                    isActive && "bg-white text-[#1f2521] hover:bg-white hover:text-[#1f2521]",
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-[#fafaf7]/92 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Web UI Foundation
              </p>
              <h1 className="truncate text-lg font-semibold text-foreground">
                Content Collector
              </h1>
            </div>
            <div className="hidden min-w-0 rounded border border-border bg-white px-3 py-2 text-xs text-muted-foreground shadow-panel sm:block">
              API: <span className="font-medium text-foreground">{apiBaseLabel}</span>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
