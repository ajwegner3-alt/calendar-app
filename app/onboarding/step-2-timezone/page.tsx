import { TimezoneForm } from "./timezone-form";

export default function Step2TimezonePage() {
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-900">Confirm your timezone</h2>
      <p className="mt-1 text-sm text-gray-500">
        Your booking slots will be shown to visitors in your timezone.
      </p>
      <div className="mt-6">
        <TimezoneForm />
      </div>
    </div>
  );
}
