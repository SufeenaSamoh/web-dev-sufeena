import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ExpiryLotsPage } from "@/features/inventory-ops/ExpiryLotsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/expiry-lots")({
  head: () => ({ meta: [{ title: "Expiry & Lot Management — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="inventory:view">
        <ExpiryLotsPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
