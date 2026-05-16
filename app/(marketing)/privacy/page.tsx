import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — North Star Booking",
  description:
    "How North Star Booking collects, uses, stores, and protects your information, including data accessed through Google APIs.",
};

const LAST_UPDATED = "May 15, 2026";
const CONTACT_EMAIL = "communications@nsintegrations.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-gray-900 sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-gray-600">
        {/* Intro */}
        <section>
          <p>
            North Star Booking (the &ldquo;Service&rdquo;) is an appointment
            scheduling application operated by North Star Integrations
            (&ldquo;North Star Integrations,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a business based in Omaha,
            Nebraska, United States. This Privacy Policy explains what
            information the Service collects, how we use it, who we share it
            with, and the choices you have.
          </p>
          <p className="mt-3">
            This policy applies to the North Star Booking application hosted at
            booking.nsintegrations.com and its booking pages and embeddable
            widget. It is separate from the privacy policy of the North Star
            Integrations marketing website at nsintegrations.com.
          </p>
        </section>

        {/* Who the policy covers */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Who This Policy Covers
          </h2>
          <p>The Service is used by two kinds of people:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-gray-900">Account holders</strong> &mdash;
              business owners and operators who create an account to manage
              appointment types, availability, and bookings.
            </li>
            <li>
              <strong className="text-gray-900">Customers</strong> &mdash;
              people who book an appointment through an account holder&rsquo;s
              booking page. When a customer books an appointment, the account
              holder is the controller of that customer&rsquo;s information, and
              North Star Integrations processes it on the account holder&rsquo;s
              behalf.
            </li>
          </ul>
        </section>

        {/* Account holder data */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Information We Collect from Account Holders
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong className="text-gray-900">Account details</strong> &mdash;
              your name, email address, and, if you sign up with a password, a
              securely hashed password.
            </li>
            <li>
              <strong className="text-gray-900">Business profile</strong>{" "}
              &mdash; your business name, time zone, logo image, brand color,
              appointment types, and availability settings.
            </li>
            <li>
              <strong className="text-gray-900">Google sign-in data</strong>{" "}
              &mdash; if you sign up or sign in with Google, we receive your
              name, email address, and Google account identifier. See{" "}
              <a href="#google" className="font-medium text-blue-600 hover:underline">
                Information Accessed Through Google APIs
              </a>{" "}
              below.
            </li>
            <li>
              <strong className="text-gray-900">Operational records</strong>{" "}
              &mdash; basic logs needed to run the Service, such as email
              delivery counts and security and rate-limiting events.
            </li>
          </ul>
        </section>

        {/* Customer data */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Information We Collect from Customers
          </h2>
          <p>
            When a customer books an appointment through an account
            holder&rsquo;s booking page, we collect the information needed to
            create and manage that booking:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Name, email address, and phone number</li>
            <li>
              Any message or answers to questions the account holder has added
              to their booking form
            </li>
            <li>
              The appointment type, date, and time, and any later cancellation
              or reschedule
            </li>
          </ul>
          <p className="mt-3">
            This information is used to confirm the appointment, send related
            emails, and let the account holder manage their schedule.
          </p>
        </section>

        {/* Google APIs — the verification-critical section */}
        <section id="google" className="scroll-mt-20">
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Information Accessed Through Google APIs
          </h2>
          <p>
            If you choose to sign in with Google or connect your Gmail account,
            the Service accesses a limited set of Google data through Google
            APIs. We request only the permissions described here.
          </p>

          <h3 className="mt-5 text-base font-semibold text-gray-900">
            Sign-in (OpenID, email, profile)
          </h3>
          <p className="mt-2">
            We use your Google account&rsquo;s basic profile information &mdash;
            name, email address, and account identifier &mdash; to create and
            identify your North Star Booking account.
          </p>

          <h3 className="mt-5 text-base font-semibold text-gray-900">
            Sending email on your behalf (gmail.send)
          </h3>
          <p className="mt-2">
            If you connect Gmail, the Service requests the{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
              https://www.googleapis.com/auth/gmail.send
            </code>{" "}
            permission. This permission is used for one purpose only: to send
            your customers&rsquo; appointment confirmation, reminder, and
            cancellation emails from your own Gmail address, so the emails come
            from you rather than from a generic system address.
          </p>
          <p className="mt-3">
            The <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">gmail.send</code>{" "}
            permission only allows sending. The Service{" "}
            <strong className="text-gray-900">
              does not read, search, import, download, modify, or delete
            </strong>{" "}
            any message in your mailbox, and it does not access your Gmail
            inbox, drafts, labels, or contacts.
          </p>
          <p className="mt-3">
            To send these emails, Google issues the Service an access token and
            a refresh token for your account. Refresh tokens are stored
            encrypted (AES-256-GCM) and are used only to obtain new access
            tokens for sending email. You can disconnect Gmail at any time from
            your account settings, which revokes the stored token.
          </p>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="text-base font-semibold text-gray-900">
              Limited Use Disclosure
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
              North Star Booking&rsquo;s use and transfer of information
              received from Google APIs to any other app will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
              Specifically, data obtained through Google APIs is used solely to
              provide and improve the user-facing features described above. We
              do not use this data for advertising, we do not sell it, and we do
              not transfer it to others except as needed to provide the Service,
              to comply with applicable law, or as part of a merger or
              acquisition. We do not allow humans to read this data unless we
              have your consent for a specific message, it is necessary for
              security purposes or to comply with applicable law, or the data
              has been aggregated and anonymized.
            </p>
          </div>
        </section>

        {/* How we use */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            How We Use Information
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To create and operate account holders&rsquo; accounts</li>
            <li>To display booking pages and process appointment bookings</li>
            <li>
              To send transactional emails &mdash; confirmations, reminders, and
              cancellation or reschedule notices
            </li>
            <li>
              To secure the Service, prevent abuse, and enforce rate limits
            </li>
            <li>To diagnose problems and improve the Service</li>
          </ul>
          <p className="mt-3">
            We do not use your information for advertising, and we do not sell
            or rent it to anyone.
          </p>
        </section>

        {/* Sharing */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            How Information Is Shared
          </h2>
          <p>
            We share information only with service providers that help us
            operate the Service, each of which handles data under its own
            privacy and security commitments:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-gray-900">Supabase</strong> &mdash; secure
              database hosting and authentication for account and booking data.
            </li>
            <li>
              <strong className="text-gray-900">Vercel</strong> &mdash;
              application hosting and infrastructure.
            </li>
            <li>
              <strong className="text-gray-900">Google</strong> &mdash; sign-in
              and, for connected accounts, Gmail email delivery.
            </li>
          </ul>
          <p className="mt-3">
            We may also disclose information if required by law or to protect
            the rights, safety, and security of our users and the Service.
            Booking information is shared with the account holder whose booking
            page received the booking, as described above.
          </p>
        </section>

        {/* Retention */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Data Retention
          </h2>
          <p>
            We retain account and booking information for as long as an account
            remains active and as needed to provide the Service. When an account
            is deleted, its data is removed within a reasonable period, except
            where we are required to retain certain records to comply with legal
            obligations.
          </p>
        </section>

        {/* Rights & deletion */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Your Choices and Data Deletion
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              You can review and update your account and business profile
              information at any time from within the Service.
            </li>
            <li>
              You can disconnect Gmail from your account settings, which revokes
              the Service&rsquo;s ability to send email on your behalf.
            </li>
            <li>
              You can request deletion of your account and associated data by
              contacting us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . We will remove your information within 30 days of a verified
              request.
            </li>
            <li>
              Customers who booked an appointment can request correction or
              deletion of their booking information by contacting the business
              they booked with, or by contacting us at the address above.
            </li>
          </ul>
        </section>

        {/* Security */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">Security</h2>
          <p>
            We take reasonable measures to protect your information. Connections
            to the Service are encrypted in transit, Google refresh tokens are
            stored encrypted at rest using AES-256-GCM, and access to data is
            restricted to what is needed to operate the Service. No method of
            transmission or storage is completely secure, but we work to protect
            your information and to address vulnerabilities promptly.
          </p>
        </section>

        {/* Children */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Children&rsquo;s Privacy
          </h2>
          <p>
            The Service is intended for businesses and adults. It is not
            directed to children under 13, and we do not knowingly collect
            personal information from children under 13.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we
            will revise the &ldquo;Last updated&rdquo; date at the top of this
            page. We encourage you to review this page periodically.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or how your
            information is handled, contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="border-t border-gray-200 pt-6 text-sm">
          <p>
            See also our{" "}
            <Link href="/terms" className="font-medium text-blue-600 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
