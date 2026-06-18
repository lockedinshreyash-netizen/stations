import type { Metadata } from "next";
import LegalDocument, {
  Section,
  P,
  List,
  CONTACT_EMAIL,
} from "@/components/legal/LegalDocument";

const LAST_UPDATED = "June 18, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Stations collects, uses, stores, and protects your personal information.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro="Stations is a community platform for ambitious people. This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices and rights you have. By creating an account or using Stations, you agree to the practices described here."
    >
      <Section heading="Information We Collect">
        <P>
          We collect only the information needed to run Stations and give you a
          working account. This includes information you provide, information
          you generate by using the platform, and a limited amount of technical
          information needed to keep the service secure and reliable.
        </P>
        <P>Information you provide or that we collect on your behalf:</P>
        <List
          items={[
            "Name — your display or full name, used to identify you in the community.",
            "Email address — used for authentication, account recovery, and important service messages.",
            "Username — your unique handle within Stations.",
            "Profile image — the avatar you upload or that is provided by Google Sign-In.",
            "User-generated content — posts, wins, messages, comments, reactions, session activity, and anything else you create.",
            "Direct messages — private messages you exchange with other members.",
            "Wins — the achievements and updates you publish to the community feed.",
            "Reactions — the reactions you add to other members' content.",
            "Notification preferences — whether you have enabled push notifications and on which devices.",
          ]}
        />
        <P>
          We also process a minimal amount of technical data — such as your
          authentication session, device push subscription tokens, and basic
          request logs — strictly to operate and protect the service.
        </P>
      </Section>

      <Section heading="How We Use Information">
        <P>We use the information we collect for the following purposes:</P>
        <List
          items={[
            "Account management — creating and maintaining your account, authenticating you, and recovering access.",
            "Community features — powering profiles, the wins feed, reactions, direct messages, challenges, announcements, and other social features.",
            "Notifications — sending push notifications you have opted into, such as direct messages, reactions, mentions, and session starts.",
            "Platform security — detecting, preventing, and responding to fraud, abuse, and violations of our Terms of Service.",
            "Product improvement — understanding how features are used so we can fix problems and make Stations better.",
          ]}
        />
        <P>
          We do not sell your personal information, and we do not use your
          private direct messages for advertising.
        </P>
      </Section>

      <Section heading="Services We Use">
        <P>
          Stations relies on a small number of trusted third-party services to
          operate. Each processes only the data needed for its function:
        </P>
        <List
          items={[
            "Supabase Auth — handles account authentication, sessions, and secure storage of your profile and content data.",
            "Google Sign-In — an optional sign-in method. When you choose it, Google shares your name, email address, and profile image with us to create your account.",
            "Push Notifications — delivered through your browser's or device's web push service to send the notifications you opt into.",
          ]}
        />
        <P>
          These providers process your data on our behalf under their own
          security and privacy commitments. We do not currently use third-party
          advertising or behavioral tracking analytics. If we introduce
          analytics in the future, we will update this policy before doing so.
        </P>
      </Section>

      <Section heading="Push Notifications">
        <P>
          Push notifications are entirely optional. You can enable or disable
          them at any time from your account settings, and you can also block
          them through your browser or device settings. When you enable them, we
          store a push subscription token for each device so we can deliver
          alerts you have asked for — such as new direct messages, reactions,
          mentions, and session activity. We never send marketing spam through
          push notifications. If you disable notifications, the associated
          subscription is removed.
        </P>
      </Section>

      <Section heading="Data Storage">
        <P>
          Your data is stored securely using Supabase, our database and
          authentication provider. Information is encrypted in transit using
          industry-standard TLS, and access is restricted by row-level security
          rules so that members can only access the data they are permitted to
          see. We retain your information for as long as your account is active
          or as needed to provide the service and meet legal obligations.
        </P>
      </Section>

      <Section heading="Data Sharing">
        <P>
          We share your information only in limited circumstances:
        </P>
        <List
          items={[
            "With other members — your profile, username, wins, reactions, and content are visible to the community as part of how Stations works. Direct messages are visible only to you and the recipient.",
            "With service providers — the trusted processors listed above, acting on our behalf to operate the platform.",
            "For legal reasons — when required by law, legal process, or to protect the rights, safety, and security of Stations and its members.",
          ]}
        />
        <P>
          We do not sell, rent, or trade your personal information to third
          parties.
        </P>
      </Section>

      <Section heading="User Content">
        <P>
          You own the content you create on Stations. By posting content, you
          grant us a limited license to host, store, and display it as needed to
          operate the platform and show it to other members. You are responsible
          for the content you share and must have the rights to share it.
          Content you make public — such as wins and reactions — may remain
          visible to the community until you remove it or delete your account.
        </P>
      </Section>

      <Section heading="Account Deletion">
        <P>
          You can request deletion of your account and associated personal data
          at any time by emailing us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[rgb(var(--fg-rgb))] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          . When you delete your account, we remove your profile and personal
          information from active systems. Some content may be retained in
          anonymized form, or where required for legal, security, or
          backup-retention reasons, and will be purged on our normal backup
          cycle. Public content you posted may need to be deleted by you before
          account closure.
        </P>
      </Section>

      <Section heading="Children's Privacy">
        <P>
          Stations is not directed to children. You must be at least 13 years
          old (or the minimum age of digital consent in your country, if higher)
          to use Stations. We do not knowingly collect personal information from
          children under that age. If we learn that we have collected such
          information, we will delete it promptly. If you believe a child has
          provided us with personal information, please contact us.
        </P>
      </Section>

      <Section heading="Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. When we make
          material changes, we will revise the &ldquo;Last updated&rdquo; date
          above and, where appropriate, notify you within the app. Your continued
          use of Stations after an update means you accept the revised policy.
        </P>
      </Section>

      <Section heading="Contact Information">
        <P>
          If you have questions, concerns, or requests regarding this Privacy
          Policy or your data, contact us at{" "}
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
