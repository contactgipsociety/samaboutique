import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/ContactsPage";

export const Route = createFileRoute("/_app/customers")({
  component: () => <ContactsPage table="customers" title="Clients" balanceLabel="Crédit client" />,
});
