import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "North Star Booking — Branded appointment scheduling for service businesses",
  description:
    "North Star Booking lets service businesses share a branded booking page, take appointments online, and send automatic confirmation and reminder emails. Built by North Star Integrations.",
};

const features = [
  {
    title: "Branded booking pages",
    body: "Every business gets its own booking page with its logo and colors — plus an embeddable widget that drops into any website.",
  },
  {
    title: "Real-time availability",
    body: "Customers only see slots that are actually open. Per-appointment buffers and capacity limits keep the schedule realistic.",
  },
  {
    title: "Automatic emails",
    body: "Confirmation and reminder emails go out automatically — sent from the business's own connected Gmail so they look personal, not robotic.",
  },
  {
    title: "Calendar invites",
    body: "Each confirmed booking includes a calendar (.ics) invite so the appointment lands directly on the customer's calendar.",
  },
  {
    title: "Self-service changes",
    body: "Customers can cancel or reschedule from a secure link without phone tag, and the business is notified of every change.",
  },
  {
    title: "Free to use",
    body: "North Star Booking is currently free. Create an account, set your availability, and start taking bookings the same day.",
  },
];

const steps = [
  {
    n: "1",
    title: "Create your account",
    body: "Sign up with email or with Google. Set your business name, time zone, logo, and brand color.",
  },
  {
    n: "2",
    title: "Set your availability",
    body: "Define your appointment types, working hours, buffers, and capacity. Share your booking link or embed the widget.",
  },
  {
    n: "3",
    title: "Take bookings",
    body: "Customers pick an open slot. Everyone gets a confirmation, a calendar invite, and an automatic reminder.",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-600">
          Appointment scheduling, simplified
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-[-0.03em] text-gray-900 sm:text-5xl">
          A branded booking page for your service business
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
          North Star Booking lets your customers pick an open time slot in a
          booking page that looks like your brand — and walk away with a
          confirmed appointment in their inbox. No phone tag, no back-and-forth.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/app/signup"
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
          >
            Get started — it&rsquo;s free
          </Link>
          <Link
            href="/app/login"
            className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-3xl">
            Everything you need to take appointments online
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-6"
              >
                <h3 className="text-base font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-3xl">
          How it works
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Google / Gmail explainer */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">
            Signing in with Google
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            You can create your North Star Booking account with a Google
            sign-in. If you choose to connect Gmail, the app uses Google&rsquo;s{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
              gmail.send
            </code>{" "}
            permission for one purpose only: to send your customers&rsquo;
            booking confirmation, reminder, and cancellation emails from your
            own Gmail address, so they look like they came from you.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            North Star Booking does not read, import, store, or analyze the
            messages in your inbox, your contacts, or any other Gmail data. The
            connection can be revoked at any time from your account settings.
            For full detail, see our{" "}
            <Link
              href="/privacy"
              className="font-medium text-blue-600 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-3xl">
          Ready to take bookings?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Create your free account and share your booking page today.
        </p>
        <Link
          href="/app/signup"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Get started — it&rsquo;s free
        </Link>
      </section>
    </main>
  );
}
