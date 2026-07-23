import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";

export const Route = createFileRoute("/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Hana" }] }),
  component: () => <AppLayout><SuppliersPage /></AppLayout>,
});