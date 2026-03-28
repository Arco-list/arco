import type { Benefit, Step, FAQItem } from "@/components/landing"

export const architectBenefits: Benefit[] = [
  {
    title: "Curated Platform",
    body: "Join a selective network of exceptional architects. Every project is reviewed to maintain the platform's high standards.",
    features: [
      "High-quality editorial showcases",
      "Invite trusted collaborators",
      "Curate your network",
    ],
  },
  {
    title: "Free Forever",
    body: "Showcase your portfolio, connect with clients, and manage inquiries — all completely free.",
    features: [
      "Upload unlimited projects",
      "Your reputation grows through who you work with",
      "Visible to every client on the platform",
    ],
  },
  {
    title: "Direct Client Access",
    body: "Reach homeowners and businesses actively looking for architectural services in the Netherlands.",
    features: [
      "Qualified leads only",
      "No ratings, reviews, or lead auctions",
      "Direct communication",
    ],
  },
]

export const architectSteps: Step[] = [
  {
    title: "Submit Your Work",
    body: "Paste a link to a project on your website. We extract images and details and build your project page automatically.",
  },
  {
    title: "Refine & Verify",
    body: "Review the generated page, adjust any details, then verify you own the domain. Your work stays connected to your practice.",
  },
  {
    title: "Get Approved",
    body: "Our editorial team reviews every submission. Accepted projects go live on the platform and become visible to clients across the Netherlands.",
  },
]

export const architectFAQ: FAQItem[] = [
  {
    question: "Is Arco really free for architects?",
    answer:
      "Yes, completely. We charge service providers who want to connect with our architect network, which keeps the platform free for you. Architects never pay to publish or participate.",
  },
  {
    question: "How selective is the application process?",
    answer:
      "We review every submission carefully, looking for thoughtful design, quality execution, and professional presentation. About 60% of applications are accepted.",
  },
  {
    question: "Can I invite my preferred contractors and professionals?",
    answer:
      "Absolutely. You can invite trusted builders, interior designers, engineers, and other professionals. When you credit them on a project, that endorsement carries real weight.",
  },
  {
    question: "How do clients find me on Arco?",
    answer:
      "Clients browse projects by style, location, and type. When they find work that resonates, they reach out directly through the platform — no bidding required.",
  },
  {
    question: "What kind of projects should I submit?",
    answer:
      "Submit your best work — completed, professionally photographed, and based in the Netherlands. You can showcase international work once accepted.",
  },
]
