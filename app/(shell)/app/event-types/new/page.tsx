import { EventTypeForm } from "../_components/event-type-form";

export default function NewEventTypePage() {
  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Create event type</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define what people can book. You can edit any of this later.
        </p>
      </header>
      <EventTypeForm mode="create" />
    </div>
  );
}
