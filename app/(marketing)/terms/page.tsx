import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — North Star Booking",
  description:
    "The terms and conditions for using North Star Booking, the appointment scheduling application by North Star Integrations.",
};

const LAST_UPDATED = "May 15, 2026";
const CONTACT_EMAIL = "communications@nsintegrations.com";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-gray-900 sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-gray-600">
        {/* Intro */}
        <section>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of
            North Star Booking (the &ldquo;Service&rdquo;), an appointment
            scheduling application operated by North Star Integrations
            (&ldquo;North Star Integrations,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a business based in Omaha,
            Nebraska, United States. By creating an account or otherwise using
            the Service, you agree to these Terms. If you do not agree, do not
            use the Service.
          </p>
        </section>

        {/* Description */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            The Service
          </h2>
          <p>
            North Star Booking lets businesses publish a branded booking page
            and embeddable widget, define appointment types and availability,
            accept bookings from their customers, and send related confirmation,
            reminder, and cancellation emails. We may add, change, or remove
            features at any time.
          </p>
        </section>

        {/* Eligibility & accounts */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Accounts
          </h2>
          <p>
            You must be at least 18 years old and able to form a binding
            contract to use the Service. You are responsible for the accuracy of
            the information you provide, for all activity that occurs under your
            account, and for keeping your login credentials secure. Notify us
            promptly of any unauthorized use of your account.
          </p>
        </section>

        {/* Cost */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Cost of the Service
          </h2>
          <p>
            The Service is currently provided free of charge. We may introduce
            paid plans in the future. If we do, we will provide notice within
            the Service before any charges would apply to your account, and you
            will be able to decide whether to continue.
          </p>
        </section>

        {/* Acceptable use */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Acceptable Use
          </h2>
          <p>You agree not to use the Service to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Violate any law or infringe the rights of others</li>
            <li>
              Send spam, or send messages to people who have not agreed to be
              contacted
            </li>
            <li>
              Upload malicious code or attempt to gain unauthorized access to
              the Service, its systems, or other users&rsquo; data
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service
            </li>
            <li>
              Misrepresent your identity or your affiliation with any person or
              business
            </li>
          </ul>
          <p className="mt-3">
            We may suspend or terminate accounts that violate these Terms.
          </p>
        </section>

        {/* Customer data */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Your Customers&rsquo; Information
          </h2>
          <p>
            If you use the Service to collect bookings, you are responsible for
            the information your customers provide to you through the Service.
            You agree to handle that information lawfully, to have any consent
            required to contact your customers, and to honor their requests
            regarding their information. We process customer booking information
            on your behalf as described in our{" "}
            <Link
              href="/privacy"
              className="font-medium text-blue-600 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        {/* Email sending */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Email Sending
          </h2>
          <p>
            If you connect a Gmail account, you authorize the Service to send
            appointment-related emails from that account on your behalf, as
            described in the Privacy Policy. You are responsible for ensuring
            this use complies with your email provider&rsquo;s terms. You may
            disconnect Gmail at any time from your account settings.
          </p>
        </section>

        {/* IP */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Intellectual Property
          </h2>
          <p>
            The Service, including its software, design, and branding, is owned
            by North Star Integrations and is protected by intellectual property
            laws. You retain ownership of the content and information you
            provide. You grant us a limited license to host and process that
            content solely to operate and provide the Service to you.
          </p>
        </section>

        {/* Availability */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Service Availability
          </h2>
          <p>
            We work to keep the Service available and reliable, but we do not
            guarantee that it will be uninterrupted or error-free. We may
            perform maintenance, modify features, or suspend the Service when
            reasonably necessary.
          </p>
        </section>

        {/* Disclaimer */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Disclaimer
          </h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available,&rdquo; without warranties of any kind, whether express or
            implied, including warranties of merchantability, fitness for a
            particular purpose, and non-infringement. We do not warrant that the
            Service will meet your requirements or that bookings, emails, or
            calendar invites will always be delivered without delay or error.
          </p>
        </section>

        {/* Liability */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, North Star Integrations
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for any loss of revenue,
            data, or business opportunities, arising from your use of or
            inability to use the Service. Our total liability for any claim
            relating to the Service is limited to one hundred U.S. dollars
            ($100).
          </p>
        </section>

        {/* Termination */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Termination
          </h2>
          <p>
            You may stop using the Service and request deletion of your account
            at any time. We may suspend or terminate your access if you violate
            these Terms or if we discontinue the Service. Sections of these
            Terms that by their nature should survive termination &mdash;
            including intellectual property, disclaimers, and limitation of
            liability &mdash; will survive.
          </p>
        </section>

        {/* Governing law */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of the State of Nebraska,
            United States, without regard to its conflict of law principles.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">
            Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. When we do, we will
            revise the &ldquo;Last updated&rdquo; date at the top of this page.
            Your continued use of the Service after changes are posted
            constitutes your acceptance of the revised Terms.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="mb-3 text-xl font-bold text-gray-900">Contact Us</h2>
          <p>
            If you have questions about these Terms, contact us at{" "}
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
            <Link
              href="/privacy"
              className="font-medium text-blue-600 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
