import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ImportExportPage } from "@/features/importexport/ImportExportPage";

export const Route = createFileRoute("/import-export")({
  head: () => ({ meta: [{ title: "Import / Export — Hana" }] }),
  component: () => <AppLayout><ImportExportPage /></AppLayout>,
});