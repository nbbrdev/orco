import {
  BellRing,
  CalendarClock,
  CircleCheck,
  FileWarning,
  ListX,
  Package,
  Palette,
  Send,
  Smartphone,
  Tags,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PublicQuoteView } from "@/features/public-quote/components/public-quote-view";
import { MAX_CATALOG_ITEMS_PER_USER } from "@/lib/db/schema/catalog-items";
import { MAX_CLIENTS_PER_USER } from "@/lib/db/schema/clients";
import { MAX_QUOTES_PER_MONTH } from "@/lib/db/schema/quote-limits";

import { sampleQuoteModel } from "../sample-quote";

// Seções da landing (NBB-97): o problema do freelancer (D6.2-A), como funciona, o que o cliente
// recebe, benefícios, perguntas frequentes e a chamada final. Textos decididos com o usuário em
// 2026-10-05 (T1 a T5). Só componentes reais, sem imagens (D4-A).

const SECTION = "mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-14 sm:py-20";
const SECTION_TITLE = "text-2xl font-semibold text-balance sm:text-3xl";

const PROBLEMS = [
  {
    icon: Tags,
    title: "Os seus preços estão espalhados.",
    pain: "Em conversas, planilhas e na memória.",
    answer:
      "No Orçô, os seus serviços e valores ficam num catálogo, e viram item de orçamento com um toque.",
  },
  {
    icon: FileWarning,
    title: "O orçamento não passa a imagem que o seu trabalho merece.",
    pain: "Texto solto no WhatsApp, PDF montado às pressas.",
    answer: "Página e PDF com o seu logo, organizados e com o total sempre certo.",
  },
  {
    icon: ListX,
    title: "Você perde o fio dos orçamentos.",
    pain: "Quem viu, quem respondeu, o que venceu.",
    answer:
      "Lista por situação, aviso quando o cliente abre ou responde e lembrete antes de vencer.",
  },
];

export function ProblemSection() {
  return (
    <section aria-labelledby="problem-title" className={SECTION}>
      <h2 id="problem-title" className={SECTION_TITLE}>
        Se você se reconhece aqui, o Orçô é para você
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, pain, answer }) => (
          <li
            key={title}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
          >
            <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">{title}</p>
            <p className="text-muted-foreground">{pain}</p>
            <p className="mt-auto border-t border-border pt-3 text-sm">
              <span className="font-medium text-primary">→ </span>
              {answer}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  {
    icon: Package,
    title: "Cadastre os seus serviços uma vez.",
    text: "Os seus preços ficam no catálogo, prontos para usar.",
  },
  {
    icon: WandSparkles,
    title: "Monte o orçamento em minutos.",
    text: "Escolha os itens, ajuste os valores, e o total sai certo, com a sua marca.",
  },
  {
    icon: Send,
    title: "Mande o link e acompanhe.",
    text: "O cliente abre sem criar conta e aprova com um toque. Você recebe o aviso.",
  },
];

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-title" className={SECTION}>
      <h2 id="how-title" className={SECTION_TITLE}>
        Como funciona
      </h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="flex gap-4">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">
                <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
                {title}
              </p>
              <p className="text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ClientPreviewSection() {
  return (
    <section
      aria-labelledby="preview-title"
      className={`${SECTION} md:grid md:grid-cols-2 md:items-center md:gap-12`}
    >
      <div className="flex flex-col gap-3">
        <h2 id="preview-title" className={SECTION_TITLE}>
          O que o seu cliente recebe
        </h2>
        <p className="text-muted-foreground">
          Uma página limpa, com o seu logo e os seus dados. Sem cadastro e sem aplicativo: é só
          abrir o link.
        </p>
      </div>
      {/* Moldura de celular com a página do cliente de verdade, com dados de exemplo. Sempre clara,
          como a página pública (NBB-92). Os botões são só desenho: quem quiser testar a aprovação
          vai ao /experimentar (NBB-95). */}
      <figure
        aria-label="Exemplo de orçamento como o cliente vê"
        className="light-scheme mx-auto w-full max-w-[22rem] rounded-[2.25rem] border-[10px] border-foreground/85 bg-background text-foreground shadow-lg"
      >
        <div className="flex flex-col gap-6 rounded-[1.6rem] p-5">
          <PublicQuoteView model={sampleQuoteModel()} logoUrl={null} compact titleAs="p" />
          <div className="grid grid-cols-2 gap-3" aria-hidden="true">
            <span className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-medium">
              Recusar
            </span>
            <span className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              Aprovar
            </span>
          </div>
        </div>
      </figure>
    </section>
  );
}

const BENEFITS = [
  { icon: Package, title: "Catálogo de serviços", text: "Os seus preços num só lugar." },
  { icon: Palette, title: "A sua marca", text: "Logo e dados no link e no PDF." },
  {
    icon: CircleCheck,
    title: "Aprovação com um toque",
    text: "Com data e hora registradas.",
  },
  {
    icon: BellRing,
    title: "Avisos",
    text: "Por e-mail e no celular quando o cliente abre ou responde.",
  },
  {
    icon: CalendarClock,
    title: "Lembrete de vencimento",
    text: "Um dia antes de o orçamento expirar.",
  },
  {
    icon: Smartphone,
    title: "Feito para o celular",
    text: "Instale como app na tela inicial.",
  },
];

export function BenefitsSection() {
  return (
    <section aria-labelledby="benefits-title" className={SECTION}>
      <h2 id="benefits-title" className={SECTION_TITLE}>
        Tudo o que você precisa para orçar, nada além disso
      </h2>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const count = (value: number) => value.toLocaleString("pt-BR");

const FAQ = [
  {
    question: "É grátis mesmo?",
    answer: (
      <>
        Sim. Há limites generosos para evitar abuso: {count(MAX_QUOTES_PER_MONTH)} orçamentos por
        mês, {count(MAX_CLIENTS_PER_USER)} clientes e {count(MAX_CATALOG_ITEMS_PER_USER)} itens no
        catálogo.
      </>
    ),
  },
  {
    question: "O meu cliente precisa criar conta?",
    answer: <>Não. Ele só abre o link e aprova ou recusa.</>,
  },
  {
    question: "A aprovação vale como contrato?",
    answer: (
      <>
        Ela registra a data, a hora e o aceite do cliente, como uma prova simples do que foi
        combinado. Não é uma assinatura digital com validade jurídica.
      </>
    ),
  },
  {
    question: "Onde ficam os meus dados?",
    answer: (
      <>
        Num servidor no Brasil. Detalhes na{" "}
        <Link
          href="/privacidade"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Política de privacidade
        </Link>
        .
      </>
    ),
  },
  {
    question: "Posso mandar em PDF?",
    answer: <>Sim. Cada orçamento também sai em PDF com a sua marca.</>,
  },
];

export function FaqSection() {
  return (
    <section aria-labelledby="faq-title" className={SECTION}>
      <h2 id="faq-title" className={SECTION_TITLE}>
        Perguntas frequentes
      </h2>
      <div className="flex flex-col divide-y divide-border border-y border-border">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 font-medium">
              {question}
              <span
                className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="pb-3 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCallSection() {
  return (
    <section
      aria-labelledby="final-title"
      className={`${SECTION} items-start sm:items-center sm:text-center`}
    >
      <h2 id="final-title" className={SECTION_TITLE}>
        Organize os seus orçamentos hoje.
      </h2>
      <Button asChild size="lg" className="w-full sm:w-auto sm:px-8">
        <Link href="/cadastro">Começar grátis</Link>
      </Button>
    </section>
  );
}
