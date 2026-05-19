import { AccordionItem } from "./Accordion";

export type Faq = { q: string; a: string };

type Props = {
  title?: string;
  faqs: Faq[];
};

export default function FaqSection({ title = "자주 묻는 질문", faqs }: Props) {
  if (!faqs || faqs.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 divide-y divide-zinc-800">
        {faqs.map(({ q, a }) => (
          <AccordionItem key={q} question={q}>
            {a}
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
