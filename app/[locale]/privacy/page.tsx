import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Arco collects, uses, and protects your personal information. Read our comprehensive privacy policy.",
}

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <main className="legal-page" style={{ paddingTop: 60 }}>
        <div className="wrap">
          <h1 className="arco-page-title">Privacy Policy</h1>
          <p className="arco-small-text legal-date">Last Updated: April 1, 2026</p>

          <div className="legal-content">
            <p>
              Thank you for using Arco! This Privacy Policy explains how Arco (&ldquo;Arco,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares information about you when you use our platform at arcolist.com (the &ldquo;Platform&rdquo;).
            </p>

            <p>
              If you are a resident of the European Union, please note that this Privacy Policy includes information required under the General Data Protection Regulation (&ldquo;GDPR&rdquo;) throughout the relevant sections below.
            </p>

            <h3>Table of Contents</h3>
            <ol>
              <li><a href="#privacy-1">Who Controls My Personal Information</a></li>
              <li><a href="#privacy-2">Personal Information We Collect</a></li>
              <li><a href="#privacy-3">How We Use Information We Collect</a></li>
              <li><a href="#privacy-4">Sharing and Disclosure</a></li>
              <li><a href="#privacy-5">Third-Party Processors and Partners</a></li>
              <li><a href="#privacy-6">Cookies and Similar Technologies</a></li>
              <li><a href="#privacy-7">Artificial Intelligence and Automated Processing</a></li>
              <li><a href="#privacy-8">International Data Transfers</a></li>
              <li><a href="#privacy-9">Your Rights</a></li>
              <li><a href="#privacy-10">Security and Breach Notification</a></li>
              <li><a href="#privacy-11">Retention</a></li>
              <li><a href="#privacy-12">Children&apos;s Privacy</a></li>
              <li><a href="#privacy-13">Changes to This Privacy Policy</a></li>
              <li><a href="#privacy-14">Contact Information</a></li>
            </ol>

            <h3 id="privacy-1">1. Who Controls My Personal Information</h3>

            <h4>1.1 Controller</h4>
            <p>
              Where this Policy mentions &ldquo;Arco,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our,&rdquo; it refers to the Arco entity that is responsible for your information under this Privacy Policy (the &ldquo;Controller&rdquo;). The Controller is Arco Global B.V. (KvK: 94568189).
            </p>

            <h4>1.2 Payments Controller</h4>
            <p>
              This Privacy Policy also applies to payment services provided through the Platform. When using payment services, you will also be providing your personal information to our payment service providers (the &ldquo;Payments Controller&rdquo;), which will be responsible for your payment-related information.
            </p>

            <h4>1.3 Professionals as Data Controllers</h4>
            <p>
              When Professionals use the Arco Platform to publish projects containing personal data (e.g., photographs of individuals or identifiable properties), they act as independent data controllers for that data. Arco processes such data as instructed by the Professional. Professionals are responsible for obtaining all necessary consents and permissions before uploading personal data to the Platform.
            </p>

            <h3 id="privacy-2">2. Personal Information We Collect</h3>

            <h4>2.1 Information Needed to Use the Arco Platform</h4>
            <p>
              We collect personal information about you when you use the Arco Platform. Without it, we may not be able to provide all services requested. This information includes:
            </p>

            <h4>2.1.1 Contact, Account, and Profile Information</h4>
            <p>
              Such as your first name, last name, phone number, postal address, email address, and profile photo, some of which will depend on the features you use.
            </p>

            <h4>2.1.2 Identity and Verification Information</h4>
            <p>
              Where appropriate, we may ask you for verification information, such as your email address, phone number, company domain ownership, or other authentication information to verify your identity or business affiliation.
            </p>

            <h4>2.1.3 Payment Transaction Information</h4>
            <p>
              Such as payment account, credit card information, bank account information, payment instrument used, date and time, payment amount, payment instrument expiration date and billing postcode, and other related transaction details.
            </p>

            <h4>2.2 Information You Choose to Give Us</h4>
            <p>You can choose to provide us with additional personal information, including:</p>

            <h4>2.2.1 Additional Profile Information</h4>
            <p>Such as preferred language(s), company description, services offered, and any additional profile information you provide.</p>

            <h4>2.2.2 Information About Others</h4>
            <p>
              Such as contact information belonging to another person, including when you invite professionals to be credited on a project. By providing us with personal information about others, you certify that you have permission to provide that information to Arco for the purposes described in this Privacy Policy.
            </p>

            <h4>2.2.3 Messaging and Introduction Requests</h4>
            <p>
              Messages sent through the introduction request feature, including message content, sender name, email address, and phone number (if provided). Messages are stored on the Platform and shared with the receiving Professional.
            </p>

            <h4>2.2.4 User-Generated Content</h4>
            <p>Such as project photos, videos, descriptions, and other content you choose to provide.</p>

            <h4>2.2.5 Support Information</h4>
            <p>Such as information collected to provide customer support services, including investigating and responding to user concerns.</p>

            <h4>2.3 Information Automatically Collected by Using the Arco Platform</h4>
            <p>When you use the Arco Platform, we automatically collect certain information. This information may include:</p>

            <h4>2.3.1 Geolocation Information</h4>
            <p>Such as precise or approximate location determined from your IP address or other information you share with us, depending on your device settings.</p>

            <h4>2.3.2 Usage Information</h4>
            <p>Such as searches, projects you have viewed, professionals you have saved, access dates and times, the pages you&apos;ve viewed or engaged with, and other actions on the Arco Platform. This information is only collected with your consent via analytics cookies (see Section 6).</p>

            <h4>2.3.3 Device Information</h4>
            <p>Such as IP address, hardware and software information, device information, unique identifiers, and crash data.</p>

            <h4>2.4 Information We Collect from Third Parties</h4>
            <p>We may collect personal information from other sources, such as:</p>

            <h4>2.4.1 Third-Party Authentication</h4>
            <p>If you choose to sign in to the Arco Platform with a third-party service, such as Google or Apple, you direct the service to send us information such as your name, email address, and profile photo as controlled by that service.</p>

            <h4>2.4.2 Google Places API</h4>
            <p>When you create a company profile, we may retrieve business information from the Google Places API, including business name, address, phone number, and website. This information is used to pre-populate your company profile and may be edited by you.</p>

            <h4>2.4.3 Other Sources</h4>
            <p>To the extent permitted by applicable law, we may receive additional information about you from third-party service providers and combine it with information we have about you.</p>

            <h3 id="privacy-3">3. How We Use Information We Collect</h3>
            <p>We use personal information as outlined in this Privacy Policy.</p>
            <p>
              If you are a resident of the European Union, each use of your personal information described below is based on one or more legal bases under the GDPR: (i) Performance of Contract, (ii) Legitimate Interests, (iii) Consent, or (iv) Compliance with Legal Obligations. See the end of each subsection for applicable legal bases.
            </p>

            <h4>3.1 Provide the Arco Platform</h4>
            <p>We may process this information to:</p>
            <ul>
              <li>enable you to access the Arco Platform and make and receive payments,</li>
              <li>enable you to communicate with professionals through introduction requests,</li>
              <li>process and respond to your requests,</li>
              <li>provide you with support,</li>
              <li>send you messages, updates, security alerts, and account notifications, and</li>
              <li>enable your use of our services.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Performance of Contract</p>

            <h4>3.2 Improve and Develop the Arco Platform</h4>
            <p>We may process this information to:</p>
            <ul>
              <li>perform analytics, debug, and conduct research (with your consent for analytics cookies),</li>
              <li>improve and develop our products and services, and</li>
              <li>provide customer service training.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Legitimate Interests; Consent (for analytics)</p>

            <h4>3.3 AI-Assisted Content Generation</h4>
            <p>We may process project and company information to:</p>
            <ul>
              <li>generate project descriptions using artificial intelligence,</li>
              <li>translate content between languages,</li>
              <li>enrich company profiles with publicly available information, and</li>
              <li>improve content quality and accuracy.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Legitimate Interests</p>

            <h4>3.4 Safeguard the Arco Platform and Community</h4>
            <p>We may process this information to:</p>
            <ul>
              <li>detect, prevent, assess, and address fraud and security risks,</li>
              <li>protect our community from illegal activities or other harmful behaviors,</li>
              <li>verify or authenticate information provided by you,</li>
              <li>implement rate limiting to prevent abuse,</li>
              <li>comply with our legal obligations,</li>
              <li>resolve disputes with our users, and</li>
              <li>enforce our Terms of Service and other policies.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Legitimate Interests; Compliance with Legal Obligations</p>

            <h4>3.5 Provide, Personalize, Measure, and Improve our Marketing</h4>
            <p>We may process this information to:</p>
            <ul>
              <li>send you promotional and marketing messages (with your consent),</li>
              <li>administer referral programs, rewards, surveys, contests, or other promotional activities, and</li>
              <li>invite you to events and relevant opportunities.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Consent (where required by law); Legitimate Interests</p>

            <h4>3.6 Provide Payment Services</h4>
            <p>Personal information is used to enable payment services, such as to:</p>
            <ul>
              <li>process subscription payments,</li>
              <li>verify your identity,</li>
              <li>detect and prevent fraud,</li>
              <li>comply with applicable legal obligations, and</li>
              <li>provide and improve payment services.</li>
            </ul>
            <p className="legal-basis">Legal Basis (EU Residents): Performance of Contract; Compliance with Legal Obligations</p>

            <h4>3.7 Automated Decision-Making</h4>
            <p>We use automated processing for the following purposes:</p>
            <ul>
              <li>Project ranking and visibility on the platform, based on content quality, engagement, and recency</li>
              <li>Spam detection in introduction requests</li>
              <li>Rate limiting to prevent abuse</li>
            </ul>
            <p>These automated processes do not produce legal effects or similarly significantly affect you. You have the right to request human review of any automated decision.</p>
            <p className="legal-basis">Legal Basis (EU Residents): Legitimate Interests</p>

            <h4>3.8 Legal Bases Explained (EU Residents)</h4>
            <p>If you are a resident of the European Union, here is an explanation of the legal bases we rely on under the GDPR:</p>
            <ul>
              <li><strong>Performance of Contract:</strong> We process your personal information to perform our contract with you. This includes processing necessary to provide you with the Arco Platform services, process payments, enable communications between users, and provide customer support.</li>
              <li><strong>Legitimate Interests:</strong> We process your personal information based on our legitimate interests, including to improve and develop the Platform, personalize your experience, safeguard our community, prevent fraud, conduct research, and enforce our policies. We only rely on legitimate interests where our interests are not overridden by your rights and interests.</li>
              <li><strong>Consent:</strong> Where required by law, we process your personal information based on your consent. This includes processing for analytics cookies, certain marketing communications, and collection of precise geolocation data. You may withdraw your consent at any time.</li>
              <li><strong>Compliance with Legal Obligations:</strong> We process your personal information to comply with applicable legal obligations, including tax and accounting requirements, identity verification requirements, and responses to valid legal requests from authorities.</li>
            </ul>

            <h3 id="privacy-4">4. Sharing and Disclosure</h3>

            <h4>4.1 Sharing With Your Consent or at Your Direction</h4>
            <p>Where you provide consent or direct us to share your information, we share your information as described at the time of consent or choice. For example, when you send an introduction request, your name, email, and message are shared with the receiving Professional.</p>

            <h4>4.2 Who We Share With</h4>
            <p>We may share your information with:</p>

            <h4>4.2.1 Other Users</h4>
            <p>To help facilitate interactions between users, we may share information in certain situations, such as your name and contact details when you send an introduction request to a Professional.</p>

            <h4>4.2.2 Service Providers</h4>
            <p>We share personal information with service providers to help us run our business. See Section 5 for a detailed list of our third-party processors.</p>

            <h4>4.3 Why We May Share Your Information</h4>

            <h4>4.3.1 Build Your Public Profile</h4>
            <p>Information you share publicly on the Arco Platform may be indexed through third-party search engines. We may make certain information publicly visible to others, such as your company profile and project information.</p>

            <h4>4.3.2 Comply with Law</h4>
            <p>As we reasonably deem appropriate, we may disclose your information to courts, law enforcement, governmental authorities, or authorized third parties, if and to the extent we are required or permitted to do so by law or where disclosure is reasonably necessary to: (i) comply with our legal obligations, (ii) comply with a valid legal request, (iii) respond to a valid legal request relating to a criminal investigation, (iv) enforce and administer our agreements with users, (v) investigate potential violations of applicable law, or (vi) protect the safety, security, rights, or property of Arco, its employees, its users, or members of the public.</p>

            <h4>4.3.3 Effectuate Business Transfers</h4>
            <p>If Arco undertakes or is involved in any merger, acquisition, reorganization, sale of assets, bankruptcy, or insolvency event, then we may sell, transfer, or share some or all of our assets, including your information in connection with such transaction. In this event, we will notify you before your personal information is transferred and becomes subject to a different privacy policy.</p>

            <h3 id="privacy-5">5. Third-Party Processors and Partners</h3>
            <p>We use the following third-party service providers to process your personal information:</p>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px 8px 0", fontWeight: 500 }}>Provider</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500 }}>Purpose</th>
                  <th style={{ textAlign: "left", padding: "8px 0 8px 12px", fontWeight: 500 }}>Location</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Supabase</td>
                  <td style={{ padding: "8px 12px" }}>Database, authentication, file storage</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>EU (Frankfurt)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Vercel</td>
                  <td style={{ padding: "8px 12px" }}>Website hosting and delivery</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>EU / US</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>PostHog</td>
                  <td style={{ padding: "8px 12px" }}>Analytics (with consent only)</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>EU</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Google Maps / Places API</td>
                  <td style={{ padding: "8px 12px" }}>Map display, company lookup, geocoding</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>US</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Resend</td>
                  <td style={{ padding: "8px 12px" }}>Transactional email delivery</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>US</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Anthropic (Claude)</td>
                  <td style={{ padding: "8px 12px" }}>AI content generation and translation</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>US</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Firecrawl</td>
                  <td style={{ padding: "8px 12px" }}>Website content extraction for project import</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>US</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                  <td style={{ padding: "8px 12px 8px 0" }}>Upstash</td>
                  <td style={{ padding: "8px 12px" }}>Rate limiting</td>
                  <td style={{ padding: "8px 0 8px 12px" }}>EU</td>
                </tr>
              </tbody>
            </table>

            <p>
              Transfers to US-based processors (Anthropic, Resend, Firecrawl, Vercel, Google) are protected by Standard Contractual Clauses (EU 2021/914) incorporated into our data processing agreements with these providers. PostHog, Supabase, and Upstash process data within the EU.
            </p>

            <h3 id="privacy-6">6. Cookies and Similar Technologies</h3>

            <h4>6.1 Essential Cookies</h4>
            <p>We use the following essential cookies that are necessary for the Platform to function. These do not require your consent:</p>
            <ul>
              <li><strong>Authentication cookies</strong> (Supabase): maintain your login session</li>
              <li><strong>Locale preference</strong>: remember your language selection (EN/NL)</li>
              <li><strong>Cookie consent</strong>: remember your cookie preference</li>
            </ul>

            <h4>6.2 Analytics Cookies</h4>
            <p>With your consent, we use analytics cookies to understand how visitors interact with the Platform:</p>
            <ul>
              <li><strong>PostHog</strong>: collects usage data including pages viewed, features used, and device information. PostHog data is processed in the EU. These cookies are only set after you click &ldquo;Accept&rdquo; on our cookie consent banner.</li>
            </ul>

            <h4>6.3 Managing Your Cookie Preferences</h4>
            <p>You can manage your cookie preferences at any time by:</p>
            <ul>
              <li>Clicking &ldquo;Reject&rdquo; on the cookie consent banner when first visiting the site</li>
              <li>Clearing your browser cookies and localStorage (this will reset your consent choice and show the banner again)</li>
              <li>Adjusting your browser settings to block or delete cookies</li>
            </ul>
            <p>Rejecting analytics cookies does not affect your ability to use the Arco Platform.</p>

            <h3 id="privacy-7">7. Artificial Intelligence and Automated Processing</h3>

            <h4>7.1 How We Use AI</h4>
            <p>
              Arco uses artificial intelligence (powered by Anthropic Claude) to assist with content creation. When you import a project or request a description, the project text and publicly available information may be sent to our AI provider for processing. Specifically, AI is used to:
            </p>
            <ul>
              <li>Generate project descriptions from imported web pages</li>
              <li>Translate content between English and Dutch</li>
              <li>Enrich company profiles with relevant information</li>
            </ul>

            <h4>7.2 Data Handling by AI Providers</h4>
            <p>
              Content sent to our AI provider (Anthropic) is processed for the specific request only and is not retained by the provider for training or other purposes beyond the immediate request, in accordance with our data processing agreement. You can review and edit all AI-generated content before it is published.
            </p>

            <h4>7.3 Your Rights Regarding AI Processing</h4>
            <p>
              You are responsible for reviewing and verifying any AI-generated content associated with your projects or company profile. You may edit or delete AI-generated content at any time. You have the right to request human review of any content generated through automated processing.
            </p>

            <h3 id="privacy-8">8. International Data Transfers</h3>

            <h4>8.1 Transfers Outside the EEA</h4>
            <p>If you reside in the European Economic Area (&ldquo;EEA&rdquo;), your personal information may be transferred to countries outside the EEA, including to the United States, where some of our service providers are located (see Section 5).</p>

            <h4>8.2 Safeguards for International Transfers</h4>
            <p>We rely on the following safeguards for international data transfers:</p>
            <ul>
              <li><strong>Standard Contractual Clauses:</strong> We use Standard Contractual Clauses (EU 2021/914) approved by the European Commission to protect personal information transferred to US-based processors including Anthropic, Resend, Firecrawl, Vercel, and Google.</li>
              <li><strong>EU-Based Processing:</strong> Where possible, we use EU-based processors. Supabase (database), PostHog (analytics), and Upstash (rate limiting) process data within the EU.</li>
            </ul>

            <h4>8.3 Your Rights Regarding Transfers</h4>
            <p>You have the right to obtain information about the safeguards we use for international transfers. To request this information, please contact us at <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>.</p>

            <h3 id="privacy-9">9. Your Rights</h3>
            <p>You may exercise any of the rights described in this section consistent with applicable law.</p>

            <h4>9.1 EU Residents</h4>
            <p>If you are a resident of the European Union, you have the following rights under the GDPR:</p>
            <ul>
              <li><strong>Right of Access:</strong> You have the right to obtain confirmation that we process your personal information and to request a copy of your personal information.</li>
              <li><strong>Right to Rectification:</strong> You have the right to correct inaccurate or incomplete personal information.</li>
              <li><strong>Right to Erasure:</strong> You have the right to request deletion of your personal information in certain circumstances. You can delete your account at any time through the Account settings page.</li>
              <li><strong>Right to Restrict Processing:</strong> You have the right to request that we restrict processing of your personal information in certain circumstances.</li>
              <li><strong>Right to Data Portability:</strong> You have the right to receive your personal information in a structured, commonly used, and machine-readable format (JSON). To request a data export, email <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>. We will provide your data within 30 days, including your profile information, uploaded content, messages, and activity history.</li>
              <li><strong>Right to Object:</strong> You have the right to object to processing of your personal information based on legitimate interests or for direct marketing purposes.</li>
              <li><strong>Right to Withdraw Consent:</strong> Where processing is based on your consent (e.g., analytics cookies), you have the right to withdraw consent at any time by rejecting cookies or adjusting your preferences.</li>
              <li><strong>Right to Lodge a Complaint:</strong> You have the right to lodge a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens) or your local supervisory authority.</li>
            </ul>
            <p>To exercise any of these rights, please contact us at <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>.</p>

            <h4>9.2 How to Opt Out</h4>
            <p>You can control your data in the following ways:</p>
            <ul>
              <li><strong>Marketing emails:</strong> Click the unsubscribe link in any marketing email</li>
              <li><strong>Analytics cookies:</strong> Reject cookies via the cookie consent banner, or clear <code>arco_cookie_consent</code> from your browser&apos;s localStorage</li>
              <li><strong>Account deletion:</strong> Go to Account settings &gt; Delete account</li>
              <li><strong>Data export:</strong> Email <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a></li>
            </ul>

            <h3 id="privacy-10">10. Security and Breach Notification</h3>

            <h4>10.1 Security Measures</h4>
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized or unlawful processing, accidental loss, destruction, or damage. These measures include:</p>
            <ul>
              <li>Encryption of data in transit (TLS) and at rest</li>
              <li>Row-level security policies on all database tables</li>
              <li>Access controls and authentication procedures</li>
              <li>Rate limiting to prevent abuse</li>
              <li>Regular security assessments</li>
            </ul>
            <p>While we strive to protect your personal information, no method of transmission over the Internet or electronic storage is completely secure. We cannot guarantee absolute security of your information.</p>

            <h4>10.2 Breach Notification</h4>
            <p>
              In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the Dutch Data Protection Authority (Autoriteit Persoonsgegevens) within 72 hours of becoming aware of the breach. We will notify affected individuals without undue delay where the breach is likely to result in a high risk to their rights and freedoms, as required by GDPR Article 34.
            </p>

            <h3 id="privacy-11">11. Retention</h3>
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy. Specifically:</p>
            <ul>
              <li><strong>Account information:</strong> Duration of your account plus 30 days after deletion, to allow for account recovery and comply with legal obligations</li>
              <li><strong>Project content and photos:</strong> Duration of your account. Upon deletion, content is removed unless published anonymously</li>
              <li><strong>Introduction request messages:</strong> 2 years after last activity</li>
              <li><strong>Analytics data (PostHog):</strong> 12 months</li>
              <li><strong>Transaction and payment records:</strong> 7 years (as required by Dutch tax law)</li>
              <li><strong>Email delivery logs:</strong> 90 days</li>
              <li><strong>Rate limiting data:</strong> 24 hours</li>
              <li><strong>Marketing communications data:</strong> Until you unsubscribe or withdraw consent</li>
            </ul>
            <p>When personal information is no longer needed, we will securely delete or anonymize it in accordance with applicable law.</p>

            <h3 id="privacy-12">12. Children&apos;s Privacy</h3>
            <p>
              The Arco Platform is not directed at children under 16 years of age. We do not knowingly collect personal information from children under 16. If we become aware that we have collected personal information from a child under 16, we will take steps to delete that information promptly. If you believe we have collected information from a child under 16, please contact us at <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>.
            </p>

            <h3 id="privacy-13">13. Changes to This Privacy Policy</h3>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will notify you by posting the updated Privacy Policy on our Platform with a new &ldquo;Last Updated&rdquo; date and, where appropriate, by email.
            </p>
            <p>
              We encourage you to review this Privacy Policy periodically. Your continued use of the Arco Platform after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.
            </p>
            <p>
              If you do not agree with any changes, you may close your account through Account settings or by contacting us.
            </p>

            <h3 id="privacy-14">14. Contact Information</h3>
            <p>
              For privacy-related questions, concerns, data access requests, or to exercise your rights under GDPR:
            </p>
            <p>
              <strong>Email:</strong>{" "}<a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>
            </p>
            <p>
              <strong>Controller:</strong><br />
              Arco Global B.V.<br />
              KvK: 94568189<br />
            </p>
            <p>
              <strong>Supervisory Authority:</strong><br />
              Autoriteit Persoonsgegevens<br />
              <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">www.autoriteitpersoonsgegevens.nl</a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
