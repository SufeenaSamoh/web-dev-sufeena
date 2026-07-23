import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ReportsPage } from "@/features/reports/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Hana" }] }),
  component: () => <AppLayout><ReportsPage /></AppLayout>,
});