import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { PurchasePage } from "@/features/purchase/PurchasePage";

export const Route = createFileRoute("/purchase")({
  head: () => ({ meta: [{ title: "Purchase — Hana" }] }),
  component: () => <AppLayout><PurchasePage /></AppLayout>,
});