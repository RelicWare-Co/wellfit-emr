import { Button } from "@wellfit-emr/ui/components/button";
import { cn } from "@wellfit-emr/ui/lib/utils";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  actionLabel?: string;
  className?: string;
  description?: string;
  onAction?: () => void;
  title?: string;
}

export function EmptyState({
  title = "Sin registros",
  description = "No se encontraron datos para mostrar.",
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="mb-3 inline-flex size-10 items-center justify-center bg-muted">
        <FolderOpen className="text-muted-foreground" size={20} />
      </div>
      <p className="font-medium text-sm">{title}</p>
      <p className="mt-1 max-w-xs text-muted-foreground text-xs">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
