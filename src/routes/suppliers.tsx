import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="master_data:view">
        <SuppliersPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
