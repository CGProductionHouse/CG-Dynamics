import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

interface LegalSection {
  title: string
  paragraphs?: string[]
  items?: string[]
}

interface LegalPageProps {
  title: string
  intro: string
  sections: LegalSection[]
}

function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-brand-bg bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_32rem)] px-4 py-10 text-white sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-brand-muted bg-brand-surface/95 p-6 shadow-[0_0_50px_rgba(45,212,191,0.08)] sm:p-10">
        <header className="border-b border-brand-muted pb-7">
          <Link to="/landing" aria-label="CG Dynamics home" className="inline-flex">
            <BrandMark subtitle="CG Production House" />
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-brand-accent">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-brand-primary">Effective 8 September 2026</p>
          <p className="mt-5 text-base leading-7 text-slate-200">{intro}</p>
        </header>

        <div className="space-y-8 pt-8">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-brand-accent">{section.title}</h2>
              {section.paragraphs?.map(paragraph => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-200">{paragraph}</p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-200">
                  {section.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-brand-muted pt-6 text-sm">
          <Link to="/privacy-policy" className="text-brand-primary hover:text-brand-accent">Privacy Policy</Link>
          <Link to="/terms-of-service" className="text-brand-primary hover:text-brand-accent">Terms of Service</Link>
          <a href="mailto:info@cgproductionhouse.com" className="text-brand-primary hover:text-brand-accent">Contact</a>
        </footer>
      </article>
    </main>
  )
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains how CG Production House uses personal information in CG Dynamics, including information received when an authorized user connects a TikTok account."
      sections={[
        {
          title: 'Information we handle',
          items: [
            'Account and profile information supplied by authorized CG Dynamics users.',
            'TikTok account identifiers, profile details, public video details, and account or video statistics permitted by the scopes the user approves.',
            'OAuth access and refresh tokens needed to maintain an authorized connection.',
            'Operational records such as connection status, synchronization history, approvals, and provider errors.',
          ],
        },
        {
          title: 'How we use information',
          items: [
            'To connect the selected client in CG Dynamics to the exact TikTok account authorized by that account holder.',
            'To display TikTok-native profile and video performance without combining unlike provider metrics.',
            'To operate approved content workflows and, only when separately enabled and authorized, provider publishing functions.',
            'To secure, diagnose, and audit the integration.',
          ],
        },
        {
          title: 'Sharing and service providers',
          paragraphs: [
            'CG Production House does not sell TikTok account information. Information is shared only with service providers needed to operate CG Dynamics, such as hosting and database providers, and with TikTok when an authorized user invokes a TikTok function. Those providers process information under their own terms and privacy policies.',
          ],
        },
        {
          title: 'Access, retention, and deletion',
          paragraphs: [
            'Access is restricted to authorized CG Production House staff and the relevant client-facing account where applicable. We retain integration information only while it is needed for the service, audit, security, or legal obligations. An authorized account holder may revoke TikTok access in TikTok and may contact us to request disconnection, access, correction, or deletion of associated personal information.',
          ],
        },
        {
          title: 'Security and contact',
          paragraphs: [
            'We use access controls and operational safeguards designed to protect integration information. No online system can guarantee absolute security. Privacy questions and requests can be sent to info@cgproductionhouse.com.',
          ],
        },
      ]}
    />
  )
}

export function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern authorized use of CG Dynamics, an internal operations and client-reporting service operated by CG Production House."
      sections={[
        {
          title: 'Authorized use',
          paragraphs: [
            'CG Dynamics is available only to invited staff, approved collaborators, and client users. Users must provide accurate information, protect their sign-in details, and use only client accounts and content they are authorized to access or manage.',
          ],
        },
        {
          title: 'Connected platforms',
          paragraphs: [
            'Connecting TikTok or another provider authorizes CG Dynamics to use only the permissions shown during that provider’s authorization flow. Provider services remain governed by the provider’s own terms, policies, availability, rate limits, and review requirements. Access may be revoked through the provider or by asking CG Production House to disconnect it.',
          ],
        },
        {
          title: 'Content and publishing',
          paragraphs: [
            'Users remain responsible for ensuring that content, account access, instructions, and approvals are lawful and authorized. CG Dynamics must not be used to publish misleading, unlawful, infringing, or unapproved material. Provider publishing is unavailable unless CG Production House has enabled it after the required approval and provider review steps.',
          ],
        },
        {
          title: 'Service operation',
          paragraphs: [
            'We work to keep CG Dynamics accurate and available, but external platforms may change data, permissions, definitions, or availability. CG Production House may suspend access to protect clients, accounts, data, or the service, and may update these terms when the service or applicable requirements change.',
          ],
        },
        {
          title: 'Contact',
          paragraphs: [
            'Questions about these terms, account access, or connected-platform data can be sent to info@cgproductionhouse.com.',
          ],
        },
      ]}
    />
  )
}
