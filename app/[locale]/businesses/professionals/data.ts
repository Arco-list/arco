import type { Benefit, Step, FAQItem } from "@/components/landing"
import type { Endorsement } from "@/components/ui/EndorsementCarousel"

export const professionalBenefits: Benefit[] = [
  {
    title: "Endorsed, Not Listed",
    body: "You're not another name in a directory. When an architect credits you on a project, it's a public endorsement of your craft.",
    features: [
      "Credibility through real project credits",
      "Endorsements from architects you've worked with",
      "Reputation built by association, not self-promotion",
    ],
  },
  {
    title: "Clients Who Are Ready",
    body: "Clients on Arco are actively planning projects. When they find your work through an architect's project, the intent is real.",
    features: [
      "Clients reach out directly — no bidding",
      "No ratings, reviews, or popularity metrics",
      "Connected to real, completed projects",
    ],
  },
  {
    title: "A Platform That Works for You",
    body: "Manage inquiries, showcase your project history, and connect with clients — all from a single professional profile.",
    features: [
      "Professional profile with full project history",
      "Direct messaging with potential clients",
      "Analytics on profile views and inquiries",
    ],
  },
]

export const professionalSteps: Step[] = [
  {
    title: "Suggest a Project",
    body: "Know a project you worked on that deserves to be seen? Send the architect a hint — we'll invite them to publish it on Arco and credit you.",
  },
  {
    title: "Get Credited",
    body: "When the architect publishes the project, they tag every professional who contributed. That credit becomes part of your profile.",
  },
  {
    title: "Receive Inquiries",
    body: "Clients browsing projects discover your work through the architects who tagged you. When they're ready to build, they reach out directly.",
  },
]

export const professionalFAQ: FAQItem[] = [
  {
    question: "What kind of professionals is Arco for?",
    answer:
      "Builders, contractors, interior designers, structural engineers, landscape architects, kitchen specialists — anyone involved in bringing architectural projects to life.",
  },
  {
    question: "How much does Arco cost for professionals?",
    answer:
      "Arco is a paid platform for professionals. Pricing details are shared once an architect has credited you on a project and you're invited to activate your profile. There are no hidden fees or long-term commitments.",
  },
  {
    question: "Can I sign up directly?",
    answer:
      "Not yet. Professionals join Arco when an architect credits them on a published project. You can speed this up by suggesting a project to an architect you've worked with — we'll send them an invitation on your behalf.",
  },
  {
    question: "How is this different from Houzz or a directory?",
    answer:
      "On Arco, your reputation is built through architect endorsements and real project credits — not reviews from anonymous users or paid placements. There are no ratings, no bidding wars, and no pay-to-play promotions.",
  },
  {
    question: "How do clients find me?",
    answer:
      "Clients browse architecture projects on Arco. When they see a project they love, they can see every professional who contributed — and reach out directly. Your visibility grows with every project you're credited on.",
  },
]

export const endorsements: Endorsement[] = [
  {
    quote:
      "We've worked with Van der Berg Bouw on four projects now. Their attention to detail is exceptional.",
    name: "Marten Kuiper",
    role: "Studio MK — Amsterdam",
    initials: "MK",
  },
  {
    quote:
      "The kind of contractor you can trust with a concept and know it'll be executed properly.",
    name: "Lisa Vermeer",
    role: "Vermeer Architecten — Rotterdam",
    initials: "LV",
  },
  {
    quote:
      "I recommend them to every client who asks. That's the highest compliment I can give.",
    name: "Joost Hendriks",
    role: "Hendriks & Partners — Utrecht",
    initials: "JH",
  },
]
