import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { UsageVariancePage } from "@/features/reports/UsageVariancePage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/usage-variance")({
  head: () => ({
    meta: [{ title: "รายงานเปรียบเทียบการใช้จริง vs ใช้ตามสูตร — Hana" }],
  }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="reports:view">
        <UsageVariancePage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
