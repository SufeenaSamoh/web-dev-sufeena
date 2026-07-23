import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { UsersPage } from "@/features/users/UsersPage";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users — Hana" }] }),
  component: () => <AppLayout><UsersPage /></AppLayout>,
});