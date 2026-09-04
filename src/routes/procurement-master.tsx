import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProcurementMasterPage } from "@/features/procurement-master/ProcurementMasterPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function ProcurementMasterRouteComponent() {
  return (
    <AppLayout>
      <ProtectedRoute permission="procurement_master:view">
        <ProcurementMasterPage />
      </ProtectedRoute>
    </AppLayout>
  );
}

export const Route = createFileRoute("/procurement-master")({
  head: () => ({ meta: [{ title: "ข้อมูลหลักจัดซื้อ — Hana" }] }),
  component: ProcurementMasterRouteComponent,
});
