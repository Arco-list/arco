import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read Arco's terms of service. Understand your rights and responsibilities when using our platform to connect with professionals.",
}

export default function TermsPage() {
  return (
    <>
      <Header />

      <main className="legal-page">
        <div className="wrap">
          <h1 className="arco-page-title">Terms of Service</h1>
          <p className="arco-small-text legal-date">Last Updated: November 24, 2025</p>

          <div className="legal-content">
            <p>
              Thank you for using Arco! These Terms of Service (&ldquo;Terms&rdquo;) are a binding legal agreement between you and Arco that govern your right to use the websites, applications, and other offerings from Arco (collectively, the &ldquo;Arco Platform&rdquo;). When used in these Terms, &ldquo;Arco,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo; refers to Arco Global B.V., the entity with whom you are contracting.
            </p>

            <p>
              The Arco Platform is a digital platform for architecture, interior design, decoration and renovation that connects homeowners with skilled professionals. The platform enables users (&ldquo;Members&rdquo;) to publish, explore, and interact with residential architectural projects. Members who publish and offer professional services are &ldquo;Professionals&rdquo; and Members who search for, view, and connect with Professionals are &ldquo;Homeowners.&rdquo; Professionals can publish projects (&ldquo;Projects&rdquo;) showcasing their work, including photography, videos, descriptions, and project features. As the provider of the Arco Platform, Arco does not own, control, or manage any Projects or professional services. Arco is not a party to any contracts entered into directly between Professionals and Homeowners, nor is Arco an architecture firm, design agency, or contractor.
            </p>

            <h2>Table of Contents</h2>

            <div className="legal-toc">
              <div>
                <h4>Homeowner Terms</h4>
                <ol>
                  <li>Exploring and Connecting on Arco</li>
                  <li>Your Responsibilities</li>
                </ol>
              </div>

              <div>
                <h4>Professional Terms</h4>
                <ol start={3}>
                  <li>Publishing on Arco</li>
                  <li>Managing Your Projects</li>
                  <li>Your Responsibilities as a Professional</li>
                </ol>
              </div>

              <div>
                <h4>General Terms</h4>
                <ol start={6}>
                  <li>Reviews and Feedback</li>
                  <li>Content</li>
                  <li>Intellectual Property</li>
                  <li>Fees</li>
                  <li>Platform Rules</li>
                  <li>Termination and Suspension</li>
                  <li>Member Accounts</li>
                  <li>Disclaimer of Warranties</li>
                  <li>Limitations on Liability</li>
                  <li>Indemnification</li>
                  <li>Governing Law and Dispute Resolution</li>
                  <li>Miscellaneous</li>
                </ol>
              </div>
            </div>

            <h2 className="legal-part-title">Homeowner Terms</h2>

            <h2>1. Exploring and Connecting on Arco</h2>

            <h3>1.1 Exploring Projects</h3>
            <p>
              You can explore residential architectural projects through the Arco Platform by browsing projects, filtering by style, location, features, or other criteria. Projects may include photos, videos, descriptions, and featured products. Each project showcases the Professionals who created the project, with links to their professional pages.
            </p>

            <h3>1.2 Connecting with Professionals</h3>
            <p>
              The Arco Platform enables you to discover and connect with Professionals for your own projects. When you contact a Professional through the Arco Platform, you may be sharing your contact information and project details with that Professional. Any agreement you enter into with a Professional is directly between you and that Professional. Arco is not a party to that agreement and has no liability for the Professional&apos;s services or conduct.
            </p>

            <h3>1.3 No Guarantees</h3>
            <p>
              Arco does not guarantee the quality, safety, or legality of any Projects or Professional services. You are responsible for conducting your own due diligence before engaging any Professional. We recommend verifying credentials, checking references, and ensuring Professionals are properly licensed and insured as required by applicable law.
            </p>

            <h2>2. Your Responsibilities</h2>

            <h3>2.1 Respectful Conduct</h3>
            <p>
              You are responsible for your own conduct on the Arco Platform. You must treat Professionals and other Members with respect, comply with applicable laws, and follow these Terms and our policies.
            </p>

            <h3>2.2 Accurate Information</h3>
            <p>
              If you provide information to Professionals or through the Arco Platform, you represent that such information is accurate and complete. You are responsible for any consequences resulting from inaccurate or incomplete information.
            </p>

            <h2 className="legal-part-title">Professional Terms</h2>

            <h2>3. Publishing on Arco</h2>

            <h3>3.1 Professional Account</h3>
            <p>
              As a Professional, Arco offers you the right to use the Arco Platform to showcase your work by publishing Projects. You can create a company page where you can provide information about your business, showcase Projects, and connect with Homeowners seeking architecture, design, decoration, construction, and renovation services.
            </p>

            <h3>3.2 Eligibility</h3>
            <p>
              To publish Projects as a Professional, you must be a qualified and legitimate provider of architecture, design, decoration, construction, and renovation services. You represent and warrant that you possess all necessary licenses, permits, insurance, and qualifications required by applicable law to provide your services. You must be legally authorized to conduct business in the jurisdictions where you operate.
            </p>

            <h3>3.3 Independence</h3>
            <p>
              Your relationship with Arco is that of an independent individual or entity and not an employee, agent, joint venturer, or partner of Arco. Arco does not direct or control your professional services, and you have complete discretion over how you provide your services.
            </p>

            <h2>4. Managing Your Projects</h2>

            <h3>4.1 Creating and Contributing to Projects</h3>
            <p>
              You can publish a Project as the project owner if you conducted the work. You can also be invited by a project owner to be associated with a Project if you contributed to it. You may only associate yourself with a Project if you actually performed work on that project.
            </p>
            <p>
              When you publish a Project, you must provide complete, accurate, and up-to-date information about the project, including high-quality photography, accurate descriptions, proper attribution of collaborators, and truthful representations of your work. You are solely responsible for all content you include in your Projects.
            </p>

            <h3>4.2 Photography and Visual Content</h3>
            <p>
              Projects must contain photography and visual content that accurately represents the completed work. You represent and warrant that you own all rights to the photography and visual content you upload, or have obtained all necessary permissions, licenses, and releases from the copyright owners and any individuals appearing in such content. You are responsible for ensuring that all photography complies with applicable privacy laws and that you have obtained consent from property owners and any individuals whose likeness appears in the content.
            </p>

            <h3>4.3 Product Attribution</h3>
            <p>
              If you include information about products, materials, or brands used in your Projects, such information must be accurate. You may not misrepresent products or provide false attribution. Any commercial relationships with product manufacturers or suppliers must be disclosed in accordance with applicable law and our policies.
            </p>

            <h3>4.4 Project Visibility</h3>
            <p>
              The visibility and ranking of Projects on the Arco Platform depend on various factors, including but not limited to: quality of photography and content, engagement from users, completeness of information, recency of publication, and relevance to user searches. Arco reserves the right to determine how Projects are displayed and ranked on the platform.
            </p>

            <h2>5. Your Responsibilities as a Professional</h2>

            <h3>5.1 Legal Compliance</h3>
            <p>
              You are responsible for understanding and complying with all laws, rules, regulations, and professional standards that apply to your services and Projects. This includes but is not limited to: licensing requirements, building codes, safety regulations, data protection and privacy laws, intellectual property laws, advertising standards, and tax obligations. You must ensure that all Projects you publish comply with applicable laws and do not infringe on any third-party rights.
            </p>

            <h3>5.2 Accurate Representation</h3>
            <p>
              You must accurately represent your qualifications, experience, and the scope of your services. You may not misrepresent your credentials, affiliations, or the work displayed in your Projects. All Projects must represent work that you have actually completed or been substantially involved in.
            </p>

            <h3>5.3 Client Confidentiality and Privacy</h3>
            <p>
              Before publishing any Project, you must obtain all necessary permissions from your clients and any other parties whose property or likeness appears in the Project. You are responsible for handling all personal data in compliance with applicable privacy laws and must not publish any confidential client information without authorization.
            </p>

            <h3>5.4 Professional Liability</h3>
            <p>
              You are solely responsible for the professional services you provide to Homeowners. You agree to maintain appropriate professional liability insurance as required by applicable law. Arco is not responsible for any claims, damages, or disputes arising from your professional services.
            </p>

            <h2 className="legal-part-title">General Terms</h2>

            <h2>6. Reviews and Feedback</h2>
            <p>
              Arco provides a review system to help community members make informed decisions. The following terms apply to all reviews left on the Arco Platform.
            </p>

            <h3>6.1 Eligibility to Review</h3>
            <p>
              Homeowners may only review Professionals who have completed work for them. Reviews may only be provided in connection with genuine professional services that were actually performed.
            </p>

            <h3>6.2 Reviews Are Not Verified</h3>
            <p>
              Reviews on the Arco Platform are not verified by Arco. Reviews may be incorrect, misleading, or reflect subjective opinions. Arco does not guarantee the accuracy or reliability of any review content. You are responsible for conducting your own due diligence when evaluating Professionals and should not rely solely on reviews.
            </p>

            <h3>6.3 Reviews Should Be Unbiased</h3>
            <p>Members may not:</p>
            <ul>
              <li>Coerce, intimidate, extort, threaten, incentivize, or manipulate another person in an attempt to influence a review</li>
              <li>Provide or withhold reviews in exchange for something of value&mdash;such as a discount, refund, reciprocal review, or promise not to take negative action</li>
              <li>Use reviews as an attempt to mislead or deceive Arco or another person</li>
              <li>Use reviews for the purpose of harming competition</li>
            </ul>

            <h3>6.4 Reviews Should Be Relevant</h3>
            <p>
              Reviews must provide relevant information about the reviewer&apos;s experience with the Professional or professional service that would help other community members make informed decisions.
            </p>

            <h3>6.5 Review Content Standards</h3>
            <p>Reviews must be appropriate and constructive. Reviews may not contain:</p>
            <ul>
              <li>Obscene, vulgar, or explicit language</li>
              <li>Discriminatory content based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics</li>
              <li>Personal attacks, threats, harassment, or bullying</li>
              <li>Fraudulent or deliberately false information</li>
              <li>Spam, promotional content, or solicitations</li>
              <li>Private or confidential information about others without their consent</li>
              <li>Content that violates applicable laws or infringes on intellectual property rights</li>
              <li>Irrelevant content unrelated to the professional service experience</li>
            </ul>

            <h3>6.6 Reporting Reviews</h3>
            <p>
              To report a review for violating this policy, contact us through our reporting mechanisms. If a review violates this policy, we may remove that review, including any associated ratings and other content. We take the removal of any review seriously and only do so where there is a clear violation of this policy. Depending on the nature of the violation, we may also restrict, suspend, or remove the associated Member account.
            </p>

            <h3>6.7 Removing a Review You Wrote</h3>
            <p>
              Once a review you&apos;ve written has been published, you can request for it to be removed by contacting us. If a review you wrote no longer reflects your genuine experience, we will consider your removal request.
            </p>

            <h2>7. Content</h2>

            <h3>7.1 Your Content</h3>
            <p>
              The Arco Platform enables you to provide, share, or communicate feedback, text, photos, audio, video, information, and other content (&ldquo;Content&rdquo;). By providing Content through the Arco Platform, you grant Arco a non-exclusive, worldwide, royalty-free, sublicensable and transferable license to access, use, store, copy, modify, prepare derivative works of, distribute, publish, transmit, and otherwise exploit such Content to provide and promote the Arco Platform, in any media or platform. You are solely responsible for all Content that you provide and warrant that you either own it or are authorized to grant Arco the rights described in these Terms.
            </p>

            <h3>7.2 Content Standards</h3>
            <p>
              All Content must be accurate and may not contain any discriminatory, offensive, defamatory, misleading, or illegal content. Content must comply with applicable laws. We reserve the right to remove, disable access to, or restrict visibility of any Content that violates these Terms or our policies.
            </p>

            <h3>7.3 Product Links</h3>
            <p>
              The Arco Platform may include links to third-party products, brands, and suppliers. These links are provided for informational purposes only. Arco is not responsible for the availability, quality, or pricing of any products, or for any transactions between you and third-party suppliers. Any purchases you make from third parties are subject to their own terms and conditions.
            </p>

            <h2>8. Intellectual Property</h2>

            <h3>8.1 Platform Ownership</h3>
            <p>
              The Arco Platform and all content made available through the platform (excluding user-generated Content) are protected by copyright, trademark, patent, trade secret, and other intellectual property laws. All rights in the Arco Platform are the exclusive property of Arco and its licensors. You may not use, copy, modify, or distribute any part of the Arco Platform except as expressly permitted in these Terms.
            </p>

            <h3>8.2 Copyright Infringement</h3>
            <p>
              Arco respects intellectual property rights. If you believe that Content on the Arco Platform infringes your copyright, please notify us with sufficient detail to enable us to investigate your claim. We will respond to valid copyright complaints in accordance with applicable law, which may include removing or disabling access to allegedly infringing Content.
            </p>

            <h3>8.3 Trademarks</h3>
            <p>
              Arco&apos;s trademarks, logos, and service marks are the property of Arco. You may not use Arco&apos;s trademarks without our prior written permission. Any unauthorized use of our trademarks may violate trademark law and these Terms.
            </p>

            <h2>9. Fees</h2>
            <p>
              Arco charges a subscription fee to Professionals for access to the Arco Platform. The applicable subscription fee and plan options can be found on the Plans page in your professional account. Arco reserves the right to modify its fee structure at any time, with notice to affected Members. If you disagree with any fee changes, you may terminate your account as provided in these Terms.
            </p>

            <h2>10. Platform Rules</h2>

            <h3>10.1 Rules of Conduct</h3>
            <p>You must follow these rules and must not help or induce others to break or circumvent these rules:</p>

            <div className="legal-rules">
              <div>
                <p><strong>Act with integrity and treat others with respect</strong></p>
                <ul>
                  <li>Do not lie, misrepresent something or someone, or pretend to be someone else</li>
                  <li>Be polite and respectful when you communicate or interact with others</li>
                  <li>Follow applicable laws and do not discriminate against or harass others</li>
                </ul>
              </div>

              <div>
                <p><strong>Do not scrape, hack, or compromise the Arco Platform</strong></p>
                <ul>
                  <li>Do not use bots, crawlers, scrapers, or other automated means to access or collect data from the Arco Platform</li>
                  <li>Do not hack, avoid, remove, impair, or otherwise attempt to circumvent any security measures protecting the Arco Platform</li>
                  <li>Do not take any action that could damage or adversely affect the performance of the Arco Platform</li>
                </ul>
              </div>

              <div>
                <p><strong>Only use the Arco Platform as authorized</strong></p>
                <ul>
                  <li>Do not use the Arco Platform for any unlawful purpose or in violation of these Terms</li>
                  <li>Do not use Members&apos; personal information except as necessary to facilitate legitimate connections through the platform</li>
                  <li>Do not send unsolicited commercial messages to other Members</li>
                  <li>Do not infringe on the intellectual property rights of Arco or any third party</li>
                  <li>Do not publish false, misleading, or deceptive Projects or Content</li>
                </ul>
              </div>

              <div>
                <p><strong>Honor your legal obligations</strong></p>
                <ul>
                  <li>Understand and follow the laws that apply to you, including privacy, data protection, and intellectual property laws</li>
                  <li>If you provide someone else&apos;s personal information, you must do so in compliance with applicable law and with proper authorization</li>
                  <li>Do not violate any professional codes of conduct or ethical standards that apply to your profession</li>
                </ul>
              </div>
            </div>

            <h3>10.2 Reporting Violations</h3>
            <p>
              If you believe that a Member, Project, or Content has violated these Terms or our policies, you should report your concerns to Arco through our reporting mechanisms. While we will review reports, we are not obligated to take action in response to any report except as required by law.
            </p>

            <h2>11. Termination and Suspension</h2>

            <h3>11.1 Termination by You</h3>
            <p>
              You may terminate your account at any time by contacting us or deleting your account through the Arco Platform.
            </p>

            <h3>11.2 Termination by Arco</h3>
            <p>
              Arco may terminate or suspend your account and access to the Arco Platform at any time, with or without notice, if you breach these Terms, violate applicable laws, or if we reasonably believe termination is necessary to protect Arco, its Members, or third parties. We may also terminate inactive accounts.
            </p>

            <h3>11.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to access and use the Arco Platform will immediately cease. If you are a Professional, your Projects may be removed from the platform. Termination does not relieve you of any obligations that accrued prior to termination. Certain provisions of these Terms will survive termination, including those related to intellectual property, liability, indemnification, and dispute resolution.
            </p>

            <h2>12. Member Accounts</h2>
            <p>
              You must register an account to access certain features of the Arco Platform. Registration is only permitted for legal entities and natural persons who are 18 years or older. You must provide accurate, current, and complete information during registration and keep your account information updated.
            </p>

            <h3>12.1 Account Security</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized access or security breach. Arco is not liable for any loss or damage arising from your failure to protect your account information.
            </p>

            <h3>12.2 Account Verification</h3>
            <p>
              Arco may require you to verify your identity or provide additional information to access certain features. We may verify the information you provide and reserve the right to reject registration or suspend accounts that cannot be adequately verified.
            </p>

            <h2>13. Disclaimer of Warranties</h2>
            <p>
              The Arco Platform and all content, Projects, and services provided through the platform are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. Arco disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              Arco does not warrant that the platform will be uninterrupted, secure, or error-free, or that any defects will be corrected. You use the Arco Platform at your own risk.
            </p>

            <h2>14. Limitations on Liability</h2>
            <p>
              To the maximum extent permitted by law, Arco shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or use, arising out of or related to these Terms or your use of the Arco Platform.
            </p>
            <p>
              Arco&apos;s total liability for all claims arising out of or relating to these Terms or the Arco Platform shall not exceed the greater of &euro;100 or the amounts you have paid to Arco in the twelve months prior to the event giving rise to liability.
            </p>
            <p>
              These limitations apply even if Arco has been advised of the possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some or all of these limitations may not apply to you.
            </p>

            <h2>15. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Arco and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or related to:
            </p>
            <ul>
              <li>Your breach of these Terms or our policies</li>
              <li>Your violation of any law or regulation</li>
              <li>Your violation of any rights of a third party</li>
              <li>Your use of the Arco Platform</li>
              <li>Any Content you provide</li>
              <li>Your provision of professional services (if you are a Professional)</li>
            </ul>

            <h2>16. Governing Law and Dispute Resolution</h2>

            <h3>16.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law provisions.
            </p>

            <h3>16.2 Dispute Resolution</h3>
            <p>
              Any dispute arising out of or relating to these Terms or the Arco Platform shall be resolved through good faith negotiations. If the dispute cannot be resolved through negotiation within 30 days, it shall be submitted to the exclusive jurisdiction of the courts of Amsterdam, the Netherlands.
            </p>

            <h3>16.3 Exceptions</h3>
            <p>
              Notwithstanding the above, Arco may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information.
            </p>

            <h2>17. Miscellaneous</h2>

            <h3>17.1 Entire Agreement</h3>
            <p>
              These Terms constitute the entire agreement between you and Arco regarding the Arco Platform and supersede all prior agreements and understandings.
            </p>

            <h3>17.2 Modifications</h3>
            <p>
              Arco may modify these Terms at any time. We will notify you of material changes by posting the updated Terms on the platform or by email. Your continued use of the Arco Platform after such notice constitutes acceptance of the modified Terms.
            </p>

            <h3>17.3 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
            </p>

            <h3>17.4 No Waiver</h3>
            <p>
              Arco&apos;s failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
            </p>

            <h3>17.5 Assignment</h3>
            <p>
              You may not assign or transfer these Terms or your account without Arco&apos;s prior written consent. Arco may assign these Terms without restriction.
            </p>

            <h3>17.6 Third-Party Beneficiaries</h3>
            <p>
              These Terms do not create any third-party beneficiary rights.
            </p>

            <h3>17.7 Contact Information</h3>
            <p>
              If you have any questions about these Terms, please email us:{" "}
              <a href="mailto:hello@arcolist.com">hello@arcolist.com</a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
