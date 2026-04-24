import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wellfit-emr/ui/components/dropdown-menu";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import { LogOut, User } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="gap-2" variant="outline">
            <User size={14} />
            <span className="hidden sm:inline">{session.user.name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <p className="font-medium text-sm">{session.user.name}</p>
            <p className="text-muted-foreground text-xs">
              {session.user.email}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/login",
                    });
                  },
                },
              });
            }}
            variant="destructive"
          >
            <LogOut size={14} />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
