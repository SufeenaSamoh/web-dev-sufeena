import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { StockCountPage } from "@/features/stockcount/StockCountPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/stock-count")({
  head: () => ({ meta: [{ title: "Stock Count — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="stock_count:view">
        <StockCountPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
