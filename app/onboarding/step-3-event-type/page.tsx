import { EventTypeForm } from "./event-type-form";

export default function Step3EventTypePage() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-medium text-gray-900">
        Create your first event type
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        This is the type of appointment clients can book with you. You can add
        more from the dashboard later.
      </p>
      <div className="mt-6">
        <EventTypeForm />
      </div>
    </div>
  );
}
