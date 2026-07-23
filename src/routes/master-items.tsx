import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MasterItemsPage } from "@/features/items/MasterItemsPage";

export const Route = createFileRoute("/master-items")({
  head: () => ({ meta: [{ title: "Master Items — Hana" }] }),
  component: () => <AppLayout><MasterItemsPage /></AppLayout>,
});