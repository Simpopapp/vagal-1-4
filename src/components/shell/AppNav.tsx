import { Link, useLocation } from "@tanstack/react-router";
import { BookOpenText, Home, Search, Sparkles } from "lucide-react";

import { QueueIndicator } from "@/components/shell/QueueIndicator";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Buscar", icon: Search },
  { to: "/vocab", label: "Vocabulário", icon: BookOpenText },
  { to: "/practice", label: "Praticar", icon: Sparkles },
] as const;

/**
 * App shell navigation. Every screen sits under it, so a user can always get
 * back to the search or to their vocabulary without losing the song they read.
 */
export function AppNav() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <Home className="size-4 text-primary" aria-hidden="true" />
          <span className="text-display text-xl leading-none">Letra e Palavra</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <QueueIndicator />
          {LINKS.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}

          <Link
            to="/settings"
            className="ml-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Ajustes
          </Link>
        </nav>
      </div>
    </header>
  );
}
