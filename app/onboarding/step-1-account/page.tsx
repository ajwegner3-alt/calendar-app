import { AccountForm } from "./account-form";

export default function Step1AccountPage() {
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900">
        Name your booking page
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose a name for your business and a unique URL for your booking page.
      </p>
      <div className="mt-6">
        <AccountForm />
      </div>
    </div>
  );
}
