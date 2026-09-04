import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { RecipeMasterPage } from "@/features/recipes/RecipeMasterPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/recipes")({
  head: () => ({ meta: [{ title: "สูตรอาหาร (Recipe Master) — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="master_data:view">
        <RecipeMasterPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
