import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ReceivingPage } from "@/features/receiving/ReceivingPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/receiving")({
  head: () => ({ meta: [{ title: "รับสินค้า — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="receiving:view">
        <ReceivingPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
