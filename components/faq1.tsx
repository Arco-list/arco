"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslations } from "next-intl"

interface FaqItem {
  id: string
  question: string
  answer: string
}

interface Faq1Props {
  heading?: string
  items?: FaqItem[]
}

const Faq1 = ({
  heading,
  items,
}: Faq1Props) => {
  const t = useTranslations("faq")

  const defaultItems: FaqItem[] = [
    {
      id: "faq-1",
      question: t("browsing_q1"),
      answer: t("browsing_a1"),
    },
    {
      id: "faq-2",
      question: t("browsing_q2"),
      answer: t("browsing_a2"),
    },
    {
      id: "faq-3",
      question: t("browsing_q3"),
      answer: t("browsing_a3"),
    },
    {
      id: "faq-4",
      question: t("browsing_q4"),
      answer: t("browsing_a4"),
    },
    {
      id: "faq-5",
      question: t("architects_q1"),
      answer: t("architects_a1"),
    },
    {
      id: "faq-6",
      question: t("architects_q2"),
      answer: t("architects_a2"),
    },
    {
      id: "faq-7",
      question: t("professionals_q1"),
      answer: t("professionals_a1"),
    },
  ]

  const displayHeading = heading ?? t("heading")
  const displayItems = items ?? defaultItems

  return (
    <section className="py-32">
      <div className="container max-w-3xl mx-auto">
        <h1 className="mb-4 text-3xl font-semibold md:mb-11 md:text-4xl text-center">{displayHeading}</h1>
        <Accordion type="single" collapsible>
          {displayItems.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="font-semibold hover:no-underline">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export { Faq1 }
