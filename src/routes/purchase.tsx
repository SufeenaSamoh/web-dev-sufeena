import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { PurchasePage } from "@/features/purchase/PurchasePage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/purchase")({
  head: () => ({ meta: [{ title: "จัดซื้อวัตถุดิบ — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="receiving:view">
        <PurchasePage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
