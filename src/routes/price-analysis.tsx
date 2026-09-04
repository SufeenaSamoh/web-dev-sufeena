import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { PriceAnalysisPage } from "@/features/reports/PriceAnalysisPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/price-analysis")({
  head: () => ({ meta: [{ title: "Price Analysis — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="reports:view">
        <PriceAnalysisPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
