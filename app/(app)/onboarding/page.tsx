import { getOrganizationContext } from "@/lib/auth/session";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata = { title: "New organization · Grant Desk" };

export default async function OnboardingPage() {
  const { organizations } = await getOrganizationContext();
  const first = organizations.length === 0;
  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {first ? "Welcome. Create your organization." : "Create another organization"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Grants, deadlines and documents belong to an organization. You can belong to more than one
          and switch between them at the top of the page.
        </p>
      </div>
      <CreateOrganizationForm />
    </div>
  );
}
