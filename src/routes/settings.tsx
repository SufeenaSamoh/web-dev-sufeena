import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="settings:manage">
        <SettingsPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
