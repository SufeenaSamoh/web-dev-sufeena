import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MasterItemsPage } from "@/features/items/MasterItemsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/master-items")({
  head: () => ({ meta: [{ title: "Master Items — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="master_data:view">
        <MasterItemsPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
