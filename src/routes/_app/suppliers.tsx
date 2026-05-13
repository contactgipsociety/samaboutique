import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/ContactsPage";

export const Route = createFileRoute("/_app/suppliers")({
  component: () => <ContactsPage table="suppliers" title="Fournisseurs" balanceLabel="Dette" />,
});
