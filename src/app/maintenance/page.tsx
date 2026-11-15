import { Metadata } from "next";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";

export const metadata: Metadata = {
  title: "Under Scheduled Update — AuraSMM",
  description: "Currently we're updating the website. All orders are actively delivering in the backend.",
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const state = await getMaintenanceState();

  return (
    <MaintenanceScreen
      customTitle={state.title}
      customMessage={state.message}
      supportTelegram={state.supportTelegram}
    />
  );
}
