import { type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { canAccess } from "@/lib/permissions";
import type { PermissionCode } from "@/lib/types";
import { ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  permission: PermissionCode | string;
  branchId?: string;
  children: ReactNode;
  reason?: string;
}

export function AccessDenied({ reason }: { reason?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <ShieldAlert className="h-12 w-12" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {reason || "You do not have permission to view or manage this module or branch."}
      </p>
    </div>
  );
}

export function ProtectedRoute({ permission, branchId, children, reason }: ProtectedRouteProps) {
  const { currentUser } = useStore();

  if (!canAccess(currentUser, permission, branchId)) {
    return <AccessDenied reason={reason} />;
  }

  return <>{children}</>;
}
