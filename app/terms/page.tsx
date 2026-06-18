import type { Metadata } from "next";
import LegalDocument, {
  Section,
  P,
  List,
  CONTACT_EMAIL,
} from "@/components/legal/LegalDocument";

const LAST_UPDATED = "June 18, 2026";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions that govern your use of the Stations community platform.",
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro="These Terms of Service govern your access to and use of Stations. By creating an account or using the platform, you agree to these terms. Please read them carefully — they include important information about your rights and responsibilities."
    >
      <Section heading="Eligibility">
        <P>
          You must be at least 13 years old (or the minimum age of digital
          consent in your country, if higher) to use Stations. By using the
          platform, you confirm that you meet this requirement and that the
          information you provide during sign-up is accurate. Stations may be
          offered by invitation or in limited cohorts; access is granted at our
          discretion.
        </P>
      </Section>

      <Section heading="Account Responsibilities">
        <P>
          You are responsible for your account and for keeping your login
          credentials secure. You agree to:
        </P>
        <List
          items={[
            "Provide accurate information and keep it up to date.",
            "Keep your password and authentication details confidential.",
            "Be responsible for all activity that occurs under your account.",
            "Notify us promptly of any unauthorized use of your account.",
          ]}
        />
      </Section>

      <Section heading="Community Conduct">
        <P>
          Stations is a community built on ambition and mutual respect. You
          agree not to:
        </P>
        <List
          items={[
            "Harass, threaten, bully, or harm other members.",
            "Post content that is illegal, hateful, sexually explicit, or violent.",
            "Spam, scam, or impersonate others, or misrepresent your affiliation.",
            "Attempt to disrupt, hack, overload, or reverse-engineer the platform.",
            "Collect or harvest other members' data without consent.",
          ]}
        />
        <P>
          We may remove content and suspend or terminate accounts that violate
          these standards.
        </P>
      </Section>

      <Section heading="User Content">
        <P>
          You retain ownership of the content you create and post on Stations.
          By posting, you grant Stations a worldwide, non-exclusive,
          royalty-free license to host, store, display, and distribute that
          content as necessary to operate and provide the platform. You are
          solely responsible for the content you share, and you represent that
          you have the rights to share it and that it does not violate these
          terms or any law.
        </P>
      </Section>

      <Section heading="Moderation">
        <P>
          To keep the community healthy, we may review, moderate, edit, or
          remove content, and we may limit, suspend, or terminate accounts that
          violate these terms or harm other members. We may act with or without
          prior notice where we believe it is necessary to protect members or
          the integrity of the platform. Moderation decisions are made at our
          reasonable discretion.
        </P>
      </Section>

      <Section heading="Platform Availability">
        <P>
          We work to keep Stations available and reliable, but we provide the
          service on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
          basis. We do not guarantee uninterrupted or error-free operation, and
          we may modify, suspend, or discontinue features at any time. Planned
          maintenance, updates, or factors beyond our control may temporarily
          affect availability.
        </P>
      </Section>

      <Section heading="Payments">
        <P>
          Some features or membership tiers may require payment. Where paid
          features are offered, the price, billing cycle, and terms will be
          presented to you before you purchase. Unless required by law or stated
          otherwise at the time of purchase, payments are non-refundable. We may
          change pricing prospectively, and any changes will not affect a billing
          period you have already paid for.
        </P>
      </Section>

      <Section heading="Intellectual Property">
        <P>
          Stations, including its name, logo, design, software, and content we
          create, is owned by Stations and protected by intellectual property
          laws. These terms do not grant you any right to use our trademarks,
          branding, or proprietary materials without our prior written
          permission. All rights not expressly granted are reserved.
        </P>
      </Section>

      <Section heading="Limitation of Liability">
        <P>
          To the maximum extent permitted by law, Stations and its operators
          will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for any loss of data, profits,
          or goodwill, arising out of or related to your use of the platform.
          Our total liability for any claim relating to the service will not
          exceed the amount you paid us, if any, in the twelve months before the
          claim.
        </P>
      </Section>

      <Section heading="Termination">
        <P>
          You may stop using Stations and delete your account at any time. We
          may suspend or terminate your access if you violate these terms, if
          required by law, or if we discontinue the service. Upon termination,
          your right to use the platform ends immediately. Provisions that by
          their nature should survive termination — such as content licenses
          already granted, intellectual property, and limitation of liability —
          will continue to apply.
        </P>
      </Section>

      <Section heading="Changes to These Terms">
        <P>
          We may update these Terms of Service from time to time. When we make
          material changes, we will revise the &ldquo;Last updated&rdquo; date
          above and, where appropriate, notify you within the app. Your
          continued use of Stations after an update means you accept the revised
          terms.
        </P>
      </Section>

      <Section heading="Contact Information">
        <P>
          If you have questions about these terms, contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </Section>
    </LegalDocument>
  );
}
