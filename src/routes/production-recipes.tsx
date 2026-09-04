import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProductionRecipesPage } from "@/features/production/ProductionRecipesPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/production-recipes")({
  head: () => ({ meta: [{ title: "สูตรผลิตสินค้ากึ่งสำเร็จรูป (Production Recipes) — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="master_data:view">
        <ProductionRecipesPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
