import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ReceivingPage } from "@/features/receiving/ReceivingPage";

export const Route = createFileRoute("/receiving")({
  head: () => ({ meta: [{ title: "Receiving — Hana" }] }),
  component: () => <AppLayout><ReceivingPage /></AppLayout>,
});