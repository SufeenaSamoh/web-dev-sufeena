import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { BeginningStockPage } from "@/features/beginning/BeginningStockPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/beginning-stock")({
  head: () => ({ meta: [{ title: "Beginning Stock — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="stock:write">
        <BeginningStockPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
