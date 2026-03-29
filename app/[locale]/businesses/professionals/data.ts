import type { Benefit, Step, FAQItem } from "@/components/landing"
import type { Endorsement } from "@/components/ui/EndorsementCarousel"

export function getProfessionalBenefits(t: (key: string) => string): Benefit[] {
  return [
    {
      title: t("benefit_1_title"),
      body: t("benefit_1_body"),
      features: [
        t("benefit_1_feature_1"),
        t("benefit_1_feature_2"),
        t("benefit_1_feature_3"),
      ],
    },
    {
      title: t("benefit_2_title"),
      body: t("benefit_2_body"),
      features: [
        t("benefit_2_feature_1"),
        t("benefit_2_feature_2"),
        t("benefit_2_feature_3"),
      ],
    },
    {
      title: t("benefit_3_title"),
      body: t("benefit_3_body"),
      features: [
        t("benefit_3_feature_1"),
        t("benefit_3_feature_2"),
        t("benefit_3_feature_3"),
      ],
    },
  ]
}

export function getProfessionalSteps(t: (key: string) => string): Step[] {
  return [
    {
      title: t("step_1_title"),
      body: t("step_1_body"),
    },
    {
      title: t("step_2_title"),
      body: t("step_2_body"),
    },
    {
      title: t("step_3_title"),
      body: t("step_3_body"),
    },
  ]
}

export function getProfessionalFAQ(t: (key: string) => string): FAQItem[] {
  return [
    {
      question: t("faq_1_q"),
      answer: t("faq_1_a"),
    },
    {
      question: t("faq_2_q"),
      answer: t("faq_2_a"),
    },
    {
      question: t("faq_3_q"),
      answer: t("faq_3_a"),
    },
    {
      question: t("faq_4_q"),
      answer: t("faq_4_a"),
    },
    {
      question: t("faq_5_q"),
      answer: t("faq_5_a"),
    },
  ]
}

export function getEndorsements(t: (key: string) => string): Endorsement[] {
  return [
    {
      quote: t("endorsement_1_quote"),
      name: t("endorsement_1_name"),
      role: t("endorsement_1_role"),
      initials: "MK",
    },
    {
      quote: t("endorsement_2_quote"),
      name: t("endorsement_2_name"),
      role: t("endorsement_2_role"),
      initials: "LV",
    },
    {
      quote: t("endorsement_3_quote"),
      name: t("endorsement_3_name"),
      role: t("endorsement_3_role"),
      initials: "JH",
    },
  ]
}
