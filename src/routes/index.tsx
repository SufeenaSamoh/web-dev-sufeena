import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function IndexPage() {
  return (
    <AppLayout>
      <ProtectedRoute permission="dashboard:view">
        <Dashboard />
      </ProtectedRoute>
    </AppLayout>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Hana Inventory Stock" }] }),
  component: IndexPage,
});
