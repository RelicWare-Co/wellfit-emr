import { Link } from "@tanstack/react-router";
import { cn } from "@wellfit-emr/ui/lib/utils";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  actions?: React.ReactNode;
  backTo?: string;
  className?: string;
  description?: string;
  title: string;
}

export function PageHeader({
  title,
  description,
  backTo,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b bg-card px-6 py-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {backTo && (
            <Link
              className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
              to={backTo}
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          <div>
            <h1 className="font-medium text-lg">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
