import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProductionBatchPage } from "@/features/production/ProductionBatchPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/production-batch")({
  validateSearch: (search: Record<string, unknown>): { itemCode?: string } => ({
    itemCode: (search.itemCode as string) || undefined,
  }),
  head: () => ({ meta: [{ title: "บันทึกการผลิตสินค้า (Production Batch) — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="inventory:view">
        <ProductionBatchPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
