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

      <main className="legal-page" style={{ paddingTop: 60 }}>
        <div className="wrap">
          <h1 className="arco-page-title">Terms of Service</h1>
          <p className="arco-small-text legal-date">Last Updated: April 1, 2026</p>

          <div className="legal-content">
            <p>
              Thank you for using Arco! These Terms of Service (&ldquo;Terms&rdquo;) are a binding legal agreement between you and Arco that govern your right to use the websites, applications, and other offerings from Arco (collectively, the &ldquo;Arco Platform&rdquo;). When used in these Terms, &ldquo;Arco,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo; refers to Arco Global B.V. (KvK: 94568189), the entity with whom you are contracting.
            </p>

            <p>
              The Arco Platform is a digital platform for architecture, interior design, decoration and renovation that connects clients with skilled professionals. The platform enables users (&ldquo;Members&rdquo;) to publish, explore, and interact with residential and commercial architectural projects. Members who publish and offer professional services are &ldquo;Professionals&rdquo; and Members who search for, view, and connect with Professionals are &ldquo;Clients.&rdquo; Professionals can publish projects (&ldquo;Projects&rdquo;) showcasing their work, including photography, videos, descriptions, and project features. As the provider of the Arco Platform, Arco does not own, control, or manage any Projects or professional services. Arco is not a party to any contracts entered into directly between Professionals and Clients, nor is Arco an architecture firm, design agency, or contractor.
            </p>

            <h3>Table of Contents</h3>

            <div className="legal-toc">
              <div>
                <h4>Client Terms</h4>
                <ol>
                  <li><a href="#section-1">Exploring and Connecting on Arco</a></li>
                  <li><a href="#section-2">Your Responsibilities</a></li>
                </ol>
              </div>

              <div>
                <h4>Professional Terms</h4>
                <ol start={3}>
                  <li><a href="#section-3">Publishing on Arco</a></li>
                  <li><a href="#section-4">Managing Your Projects</a></li>
                  <li><a href="#section-5">Your Responsibilities as a Professional</a></li>
                </ol>
              </div>

              <div>
                <h4>General Terms</h4>
                <ol start={6}>
                  <li><a href="#section-6">Content and Copyright</a></li>
                  <li><a href="#section-7">Intellectual Property</a></li>
                  <li><a href="#section-8">Messaging and Introduction Requests</a></li>
                  <li><a href="#section-9">Fees</a></li>
                  <li><a href="#section-10">AI-Generated Content</a></li>
                  <li><a href="#section-11">Platform Rules</a></li>
                  <li><a href="#section-12">Termination and Suspension</a></li>
                  <li><a href="#section-13">Member Accounts</a></li>
                  <li><a href="#section-14">Disclaimer of Warranties</a></li>
                  <li><a href="#section-15">Limitations on Liability</a></li>
                  <li><a href="#section-16">Indemnification</a></li>
                  <li><a href="#section-17">Governing Law and Dispute Resolution</a></li>
                  <li><a href="#section-18">Miscellaneous</a></li>
                </ol>
              </div>
            </div>

            <h2>Client Terms</h2>

            <h3 id="section-1">1. Exploring and Connecting on Arco</h3>

            <h4>1.1 Exploring Projects</h4>
            <p>
              You can explore architectural projects through the Arco Platform by browsing projects, filtering by style, location, features, or other criteria. Projects may include photos, videos, descriptions, and featured products. Each project showcases the Professionals who created the project, with links to their professional pages.
            </p>

            <h4>1.2 Connecting with Professionals</h4>
            <p>
              The Arco Platform enables you to discover and connect with Professionals for your own projects. When you contact a Professional through the Arco Platform, including through introduction requests, you may be sharing your contact information and project details with that Professional. Any agreement you enter into with a Professional is directly between you and that Professional. Arco is not a party to that agreement and has no liability for the Professional&apos;s services or conduct.
            </p>

            <h4>1.3 No Guarantees</h4>
            <p>
              Arco does not guarantee the quality, safety, or legality of any Projects or Professional services. Arco does not verify, endorse, or guarantee the accuracy, completeness, or reliability of any information displayed on project pages, professional pages, or company profiles. This includes but is not limited to: project descriptions, photography, professional qualifications, credentials, portfolio claims, pricing, availability, and service descriptions. You are responsible for conducting your own due diligence before engaging any Professional. We recommend verifying credentials, checking references, and ensuring Professionals are properly licensed and insured as required by applicable law. You rely on information displayed on the Arco Platform at your own risk.
            </p>

            <h3 id="section-2">2. Your Responsibilities</h3>

            <h4>2.1 Respectful Conduct</h4>
            <p>
              You are responsible for your own conduct on the Arco Platform. You must treat Professionals and other Members with respect, comply with applicable laws, and follow these Terms and our policies.
            </p>

            <h4>2.2 Accurate Information</h4>
            <p>
              If you provide information to Professionals or through the Arco Platform, you represent that such information is accurate and complete. You are responsible for any consequences resulting from inaccurate or incomplete information.
            </p>

            <h2>Professional Terms</h2>

            <h3 id="section-3">3. Publishing on Arco</h3>

            <h4>3.1 Professional Account</h4>
            <p>
              As a Professional, Arco offers you the right to use the Arco Platform to showcase your work by publishing Projects. You can create a company page where you can provide information about your business, showcase Projects, and connect with Clients seeking architecture, design, decoration, construction, and renovation services.
            </p>

            <h4>3.2 Eligibility</h4>
            <p>
              To publish Projects as a Professional, you must be a qualified and legitimate provider of architecture, design, decoration, construction, and renovation services. You represent and warrant that you possess all necessary licenses, permits, insurance, and qualifications required by applicable law to provide your services. You must be legally authorized to conduct business in the jurisdictions where you operate.
            </p>

            <h4>3.3 Independence</h4>
            <p>
              Your relationship with Arco is that of an independent individual or entity and not an employee, agent, joint venturer, or partner of Arco. Arco does not direct or control your professional services, and you have complete discretion over how you provide your services.
            </p>

            <h3 id="section-4">4. Managing Your Projects</h3>

            <h4>4.1 Creating and Contributing to Projects</h4>
            <p>
              You can publish a Project as the project owner if you conducted the work. You can also be invited by a project owner to be associated with a Project if you contributed to it. You may only associate yourself with a Project if you actually performed work on that project.
            </p>
            <p>
              When you publish a Project, you must provide complete, accurate, and up-to-date information about the project, including high-quality photography, accurate descriptions, proper attribution of collaborators, and truthful representations of your work. You are solely responsible for all content you include in your Projects.
            </p>

            <h4>4.2 Photography and Visual Content</h4>
            <p>
              Projects must contain photography and visual content that accurately represents the completed work. Photography must not be misleadingly edited or manipulated in a way that misrepresents the actual project.
            </p>
            <p>
              You represent and warrant that you are the copyright owner of all photography and visual content you upload, or that you have obtained a written, irrevocable license from the copyright owner (e.g., the photographer) granting you the right to sublicense such content to Arco as described in these Terms. You must possess either: (a) full copyright ownership, or (b) a written license or release from the photographer that permits use on third-party platforms including sublicensing. You agree to provide proof of such ownership or license upon request by Arco.
            </p>
            <p>
              You are responsible for ensuring that all photography complies with applicable privacy laws and that you have obtained consent from property owners and any individuals whose likeness appears in the content.
            </p>

            <h4>4.3 Content Truthfulness and Standards</h4>
            <p>
              All Content published on the Arco Platform must be truthful, accurate, and not misleading. Professionals must ensure that:
            </p>
            <ul>
              <li>Projects represent work actually completed by them or their credited collaborators</li>
              <li>Photography accurately depicts the completed project</li>
              <li>Professional qualifications, certifications, and experience claims are verifiable and current</li>
              <li>Company information including team size, location, and services offered is up to date</li>
              <li>All Content complies with applicable laws and platform standards</li>
            </ul>
            <p>
              Arco reserves the right to remove Content that violates these standards and to suspend or terminate accounts of repeat offenders without prior notice.
            </p>

            <h4>4.4 Product Attribution</h4>
            <p>
              If you include information about products, materials, or brands used in your Projects, such information must be accurate. You may not misrepresent products or provide false attribution. Any commercial relationships with product manufacturers or suppliers must be disclosed in accordance with applicable law and our policies.
            </p>

            <h4>4.5 Project Visibility</h4>
            <p>
              The visibility and ranking of Projects on the Arco Platform depend on various factors, including but not limited to: quality of photography and content, engagement from users, completeness of information, recency of publication, and relevance to user searches. Arco reserves the right to determine how Projects are displayed and ranked on the platform.
            </p>

            <h3 id="section-5">5. Your Responsibilities as a Professional</h3>

            <h4>5.1 Legal Compliance</h4>
            <p>
              You are responsible for understanding and complying with all laws, rules, regulations, and professional standards that apply to your services and Projects. This includes but is not limited to: licensing requirements, building codes, safety regulations, data protection and privacy laws, intellectual property laws, advertising standards, and tax obligations. You must ensure that all Projects you publish comply with applicable laws and do not infringe on any third-party rights.
            </p>

            <h4>5.2 Accurate Representation</h4>
            <p>
              You must accurately represent your qualifications, experience, and the scope of your services. You may not misrepresent your credentials, affiliations, or the work displayed in your Projects. All Projects must represent work that you have actually completed or been substantially involved in.
            </p>

            <h4>5.3 Client Confidentiality and Privacy</h4>
            <p>
              Before publishing any Project, you must obtain all necessary permissions from your clients and any other parties whose property or likeness appears in the Project. You are responsible for handling all personal data in compliance with applicable privacy laws and must not publish any confidential client information without authorization.
            </p>

            <h4>5.4 Professional Liability</h4>
            <p>
              You are solely responsible for the professional services you provide to Clients. You agree to maintain appropriate professional liability insurance as required by applicable law. Arco is not responsible for any claims, damages, or disputes arising from your professional services.
            </p>

            <h2>General Terms</h2>

            <h3 id="section-6">6. Content and Copyright</h3>

            <h4>6.1 Your Content</h4>
            <p>
              The Arco Platform enables you to provide, share, or communicate feedback, text, photos, audio, video, information, and other content (&ldquo;Content&rdquo;). By providing Content through the Arco Platform, you grant Arco a non-exclusive, worldwide, royalty-free, sublicensable and transferable license to access, use, store, copy, modify, prepare derivative works of, distribute, publish, transmit, and otherwise exploit such Content to provide and promote the Arco Platform. This license includes the right to use your Content for platform operation, marketing, advertising, social media, press materials, email communications, partner integrations, and any other promotional purposes, in any medium or format, worldwide and without geographic restriction.
            </p>
            <p>
              You are solely responsible for all Content that you provide and warrant that you either own it or are authorized to grant Arco the rights described in these Terms.
            </p>

            <h4>6.2 Copyright Ownership Warranty</h4>
            <p>
              By uploading photography or other visual content, you represent and warrant that:
            </p>
            <ul>
              <li>You are the copyright owner of the content, or</li>
              <li>You have obtained a written, irrevocable license from the copyright owner that permits you to sublicense the content to Arco as described in these Terms</li>
              <li>You have obtained all necessary releases and permissions from any individuals appearing in the content</li>
              <li>You have obtained permission from the property owner to photograph and publish images of the property</li>
              <li>The content does not infringe on any third-party intellectual property rights</li>
            </ul>
            <p>
              You agree to provide proof of copyright ownership or license upon request by Arco. If Arco receives a valid copyright complaint regarding your Content, we may remove the Content and restrict or suspend your account.
            </p>

            <h4>6.3 Content Standards</h4>
            <p>
              All Content must be accurate and may not contain any discriminatory, offensive, defamatory, misleading, or illegal content. Content must comply with applicable laws. We reserve the right to remove, disable access to, or restrict visibility of any Content that violates these Terms or our policies.
            </p>

            <h4>6.4 Right to Remove Content</h4>
            <p>
              Arco may, at its sole discretion and without prior notice, remove, hide, or restrict any Content that we believe: (a) violates these Terms, (b) may expose Arco to legal liability, (c) does not meet our quality or editorial standards, or (d) is the subject of a third-party complaint. Such removal does not obligate Arco to provide a reason or restore the Content.
            </p>

            <h4>6.5 Product Links</h4>
            <p>
              The Arco Platform may include links to third-party products, brands, and suppliers. These links are provided for informational purposes only. Arco is not responsible for the availability, quality, or pricing of any products, or for any transactions between you and third-party suppliers. Any purchases you make from third parties are subject to their own terms and conditions.
            </p>

            <h3 id="section-7">7. Intellectual Property</h3>

            <h4>7.1 Platform Ownership</h4>
            <p>
              The Arco Platform and all content made available through the platform (excluding user-generated Content) are protected by copyright, trademark, patent, trade secret, and other intellectual property laws. All rights in the Arco Platform are the exclusive property of Arco and its licensors. You may not use, copy, modify, or distribute any part of the Arco Platform except as expressly permitted in these Terms.
            </p>

            <h4>7.2 Copyright Infringement</h4>
            <p>
              Arco respects intellectual property rights. If you believe that Content on the Arco Platform infringes your copyright, please notify us with sufficient detail to enable us to investigate your claim. We will respond to valid copyright complaints in accordance with applicable law, which may include removing or disabling access to allegedly infringing Content.
            </p>

            <h4>7.3 Trademarks</h4>
            <p>
              Arco&apos;s trademarks, logos, and service marks are the property of Arco. You may not use Arco&apos;s trademarks without our prior written permission. Any unauthorized use of our trademarks may violate trademark law and these Terms.
            </p>

            <h3 id="section-8">8. Messaging and Introduction Requests</h3>
            <p>
              The Arco Platform enables Clients to send introduction requests to Professionals. By sending an introduction request, you consent to sharing your name, email address, phone number (if provided), and message content with the receiving Professional.
            </p>
            <p>
              Arco does not monitor or moderate the content of introduction requests but reserves the right to restrict messaging privileges for users who send spam, harassment, or inappropriate content. Messages are stored on the Arco Platform and are accessible to both sender and recipient.
            </p>
            <p>
              Professionals may not use contact information received through introduction requests for any purpose other than responding to the specific inquiry. Bulk marketing or unsolicited communications to Clients using contact information obtained through the platform is prohibited.
            </p>

            <h3 id="section-9">9. Fees</h3>
            <p>
              Arco offers a free tier that allows Professionals to maintain a company page and be credited on projects. Additional features, including premium placement and enhanced visibility, are available through paid subscription plans. Subscription details and pricing are available on the Plans page in your professional account.
            </p>
            <p>
              Arco reserves the right to modify its fee structure at any time, with notice to affected Members. If you disagree with any fee changes, you may terminate your account as provided in these Terms.
            </p>

            <h3 id="section-10">10. AI-Generated Content</h3>
            <p>
              Arco may use artificial intelligence and automated tools to assist with content creation, including generating project descriptions, translations, and enrichment of company profiles. AI-generated content is provided as a starting point and may be edited by users. Arco does not guarantee the accuracy of AI-generated content.
            </p>
            <p>
              You are responsible for reviewing and verifying any AI-generated content associated with your projects or company profile before it is published. By publishing AI-generated content, you accept responsibility for its accuracy.
            </p>

            <h3 id="section-11">11. Platform Rules</h3>

            <h4>11.1 Rules of Conduct</h4>
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

            <h4>11.2 Reporting Violations</h4>
            <p>
              If you believe that a Member, Project, or Content has violated these Terms or our policies, you should report your concerns to Arco through our reporting mechanisms. While we will review reports, we are not obligated to take action in response to any report except as required by law.
            </p>

            <h3 id="section-12">12. Termination and Suspension</h3>

            <h4>12.1 Termination by You</h4>
            <p>
              You may terminate your account at any time through the Account settings page on the Arco Platform or by contacting us.
            </p>

            <h4>12.2 Termination by Arco</h4>
            <p>
              Arco may terminate or suspend your account and access to the Arco Platform at any time, with or without notice, if you breach these Terms, violate applicable laws, or if we reasonably believe termination is necessary to protect Arco, its Members, or third parties. We may also terminate inactive accounts.
            </p>

            <h4>12.3 Effect of Termination</h4>
            <p>
              Upon termination, your right to access and use the Arco Platform will immediately cease. If you are a Professional, your Projects may be removed from the platform. Projects credited to a deleted Professional account may remain visible but the professional attribution will be removed. Termination does not relieve you of any obligations that accrued prior to termination. Certain provisions of these Terms will survive termination, including those related to intellectual property, liability, indemnification, and dispute resolution.
            </p>

            <h3 id="section-13">13. Member Accounts</h3>
            <p>
              You must register an account to access certain features of the Arco Platform. Registration is only permitted for legal entities and natural persons who are 16 years or older. You must provide accurate, current, and complete information during registration and keep your account information updated.
            </p>

            <h4>13.1 Account Security</h4>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized access or security breach. Arco is not liable for any loss or damage arising from your failure to protect your account information.
            </p>

            <h4>13.2 Account Verification</h4>
            <p>
              Arco may require you to verify your identity or provide additional information to access certain features. We may verify the information you provide and reserve the right to reject registration or suspend accounts that cannot be adequately verified.
            </p>

            <h3 id="section-14">14. Disclaimer of Warranties</h3>
            <p>
              The Arco Platform and all content, Projects, and services provided through the platform are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. Arco disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              Arco does not warrant that the platform will be uninterrupted, secure, or error-free, or that any defects will be corrected. Arco does not guarantee continuous availability of the Platform and may perform maintenance, updates, or modifications that temporarily affect access. You use the Arco Platform at your own risk.
            </p>
            <p>
              Arco is not responsible for any errors, inaccuracies, or omissions in the content displayed on project pages, professional pages, or company profiles. Professionals are solely responsible for the accuracy of their Content, and Arco makes no representations regarding the quality, safety, legality, or suitability of any Professional&apos;s services.
            </p>

            <h3 id="section-15">15. Limitations on Liability</h3>
            <p>
              To the maximum extent permitted by law, Arco shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or use, arising out of or related to these Terms or your use of the Arco Platform.
            </p>
            <p>
              Arco&apos;s total liability for all claims arising out of or relating to these Terms or the Arco Platform shall not exceed the greater of &euro;100 or the amounts you have paid to Arco in the twelve months prior to the event giving rise to liability.
            </p>
            <p>
              These limitations apply even if Arco has been advised of the possibility of such damages. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some or all of these limitations may not apply to you.
            </p>

            <h3 id="section-16">16. Indemnification</h3>
            <p>
              You agree to indemnify, defend, and hold harmless Arco and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or related to:
            </p>
            <ul>
              <li>Your breach of these Terms or our policies</li>
              <li>Your violation of any law or regulation</li>
              <li>Your violation of any rights of a third party, including intellectual property and copyright rights</li>
              <li>Your use of the Arco Platform</li>
              <li>Any Content you provide, including claims that your Content infringes third-party copyrights</li>
              <li>Your provision of professional services (if you are a Professional)</li>
            </ul>

            <h3 id="section-17">17. Governing Law and Dispute Resolution</h3>

            <h4>17.1 Governing Law</h4>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Netherlands, without regard to its conflict of law provisions.
            </p>

            <h4>17.2 Dispute Resolution</h4>
            <p>
              Any dispute arising out of or relating to these Terms or the Arco Platform shall be resolved through good faith negotiations. If the dispute cannot be resolved through negotiation within 30 days, it shall be submitted to the exclusive jurisdiction of the courts of Amsterdam, the Netherlands.
            </p>

            <h4>17.3 Exceptions</h4>
            <p>
              Notwithstanding the above, Arco may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information.
            </p>

            <h3 id="section-18">18. Miscellaneous</h3>

            <h4>18.1 Entire Agreement</h4>
            <p>
              These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and Arco regarding the Arco Platform and supersede all prior agreements and understandings.
            </p>

            <h4>18.2 Modifications</h4>
            <p>
              Arco may modify these Terms at any time. We will notify you of material changes by posting the updated Terms on the platform or by email. Your continued use of the Arco Platform after such notice constitutes acceptance of the modified Terms.
            </p>

            <h4>18.3 Severability</h4>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
            </p>

            <h4>18.4 No Waiver</h4>
            <p>
              Arco&apos;s failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
            </p>

            <h4>18.5 Assignment</h4>
            <p>
              You may not assign or transfer these Terms or your account without Arco&apos;s prior written consent. Arco may assign these Terms without restriction.
            </p>

            <h4>18.6 Third-Party Beneficiaries</h4>
            <p>
              These Terms do not create any third-party beneficiary rights.
            </p>

            <h4>18.7 Contact Information</h4>
            <p>
              If you have any questions about these Terms, please email us:{" "}
              <a href="mailto:privacy@arcolist.com">privacy@arcolist.com</a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
