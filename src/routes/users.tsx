import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { UsersPage } from "@/features/users/UsersPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users — Hana" }] }),
  component: () => (
    <AppLayout>
      <ProtectedRoute permission="user_management:manage">
        <UsersPage />
      </ProtectedRoute>
    </AppLayout>
  ),
});
