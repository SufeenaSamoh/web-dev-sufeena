import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { BeginningStockPage } from "@/features/beginning/BeginningStockPage";

export const Route = createFileRoute("/beginning-stock")({
  head: () => ({ meta: [{ title: "Beginning Stock — Hana" }] }),
  component: () => <AppLayout><BeginningStockPage /></AppLayout>,
});