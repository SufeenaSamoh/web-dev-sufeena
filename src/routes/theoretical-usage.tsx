import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { TheoreticalUsagePage } from "@/features/reports/TheoreticalUsagePage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/theoretical-usage")({
  head: () => ({ meta: [{ title: "การใช้ตามสูตร (Theoretical Usage) — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="reports:view">
        <TheoreticalUsagePage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
