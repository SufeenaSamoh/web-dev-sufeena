import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SalesImportPage } from "@/features/sales/SalesImportPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/sales-import")({
  head: () => ({ meta: [{ title: "Import ยอดขาย (Weekly Sales Import) — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="stock_count:view">
        <SalesImportPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
