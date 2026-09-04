import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="reports:view">
        <ReportsPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
