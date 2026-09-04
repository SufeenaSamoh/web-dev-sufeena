import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { InventoryMovementPage } from "@/features/reports/InventoryMovementPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/inventory-movement")({
  head: () => ({ meta: [{ title: "Inventory Movement — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="reports:view">
        <InventoryMovementPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
