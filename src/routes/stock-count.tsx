import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { InventoryOpsPage } from "@/features/inventory-ops/InventoryOpsPage";

export const Route = createFileRoute("/stock-count")({
  head: () => ({ meta: [{ title: "Stock Count — Hana" }] }),
  component: () => (
    <AppLayout>
      <InventoryOpsPage />
    </AppLayout>
  ),
});