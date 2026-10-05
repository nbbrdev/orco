import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/components/legal-page";
import { CONTACT_EMAIL, CONTROLLER_NAME, TERMS_UPDATED_AT } from "@/features/legal/constants";
import { MAX_CATALOG_ITEMS_PER_USER } from "@/lib/db/schema/catalog-items";
import { MAX_CLIENTS_PER_USER } from "@/lib/db/schema/clients";
import { MAX_ITEMS_PER_QUOTE, MAX_QUOTES_PER_MONTH } from "@/lib/db/schema/quote-limits";

export const metadata: Metadata = { title: "Termos de uso" };

// Termos de uso (RF-34, NBB-30 T7; R1 a R5 e licença A em 2026-10-05: o mínimo de compromissos para
// um serviço gratuito mantido por uma pessoa). Os limites vêm das mesmas constantes que o banco confere
// (RN-38). Mudou algo? Atualize a data em constants.ts (item 13).

export default function TermsPage() {
  const number = (value: number) => value.toLocaleString("pt-BR");

  return (
    <LegalPage title="Termos de uso" updatedAt={TERMS_UPDATED_AT}>
      <section>
        <p>
          Estes termos valem para quem usa o Orçô, a ferramenta de orçamentos mantida por{" "}
          <strong>{CONTROLLER_NAME}</strong>. Ao criar uma conta, você concorda com eles e com a{" "}
          <Link href="/privacidade">Política de privacidade</Link>. Dúvidas:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>1. O serviço</h2>
        <p>
          O Orçô permite criar orçamentos, enviá-los por link ou PDF e receber a aprovação ou a
          recusa do cliente. O uso é <strong>gratuito</strong>. Se um dia existir um plano pago, ele
          só valerá com aviso prévio e com o seu aceite; nada será cobrado sem isso.
        </p>
      </section>

      <section>
        <h2>2. Quem pode usar</h2>
        <p>
          O Orçô é para uso profissional, por maiores de 18 anos. Você é responsável por manter a
          sua senha em segredo e por tudo o que for feito com a sua conta.
        </p>
      </section>

      <section>
        <h2>3. Sem garantias</h2>
        <p>
          O Orçô é fornecido <strong>como está</strong>, sem garantia de que funcione sem
          interrupções, de que não tenha erros ou de que atenda a uma necessidade específica sua.
          Pode haver falhas e pausas. Também <strong>não há garantia contra perda de dados</strong>:
          guarde o PDF dos orçamentos importantes.
        </p>
      </section>

      <section>
        <h2>4. Sua responsabilidade</h2>
        <ul>
          <li>
            Você responde pelo conteúdo dos seus orçamentos (descrições, preços, condições e prazos)
            e pelo que combinar com os seus clientes.
          </li>
          <li>
            Os dados dos seus clientes são de sua responsabilidade: só cadastre dados que você tem
            motivo legítimo para usar, como um orçamento que o próprio cliente pediu. Para esses
            dados, você é o controlador e o Orçô trata em seu nome (veja a{" "}
            <Link href="/privacidade">Política de privacidade</Link>).
          </li>
          <li>
            Não cadastre dados sensíveis (como saúde, religião, origem racial ou orientação sexual):
            o Orçô não precisa deles.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. O que não é permitido</h2>
        <ul>
          <li>Usar o Orçô para golpes ou orçamentos falsos.</li>
          <li>Enviar links de orçamento como spam.</li>
          <li>Publicar conteúdo ilegal ou que viole direitos de terceiros.</li>
          <li>Tentar burlar os limites de uso ou a segurança do Orçô.</li>
          <li>Usar robôs ou automações que sobrecarreguem o serviço.</li>
        </ul>
      </section>

      <section>
        <h2>6. A aprovação pelo link</h2>
        <p>
          Quando o cliente aprova ou recusa pelo link, o Orçô registra a data, a hora, o endereço
          IP, o navegador e a versão do orçamento. Esse registro é uma{" "}
          <strong>prova simples</strong> do aceite: não é assinatura digital nem contrato. O Orçô
          não participa da negociação nem do pagamento entre você e o seu cliente.
        </p>
      </section>

      <section>
        <h2>7. Limites de uso</h2>
        <p>Para manter o serviço gratuito e estável, cada conta pode ter:</p>
        <ul>
          <li>até {number(MAX_QUOTES_PER_MONTH)} orçamentos criados por mês;</li>
          <li>até {number(MAX_ITEMS_PER_QUOTE)} itens por orçamento;</li>
          <li>até {number(MAX_CLIENTS_PER_USER)} clientes;</li>
          <li>até {number(MAX_CATALOG_ITEMS_PER_USER)} itens no catálogo.</li>
        </ul>
      </section>

      <section>
        <h2>8. Suspensão e exclusão</h2>
        <p>
          Contas que violarem estes termos podem ser suspensas ou excluídas. Você pode excluir a sua
          conta quando quiser, no Perfil: os dados são apagados na hora, e eventuais cópias de
          segurança são substituídas com o tempo.
        </p>
      </section>

      <section>
        <h2>9. O seu conteúdo</h2>
        <p>
          O que você cadastra continua sendo seu. O Orçô só guarda e processa esse conteúdo para
          prestar o serviço.
        </p>
      </section>

      <section>
        <h2>10. O código e a marca</h2>
        <p>
          O código do Orçô é público para consulta, mas não é licenciado para cópia nem
          reutilização. O código, o nome Orçô e o logo pertencem ao mantenedor.
        </p>
      </section>

      <section>
        <h2>11. Limitação de responsabilidade</h2>
        <p>
          No limite que a lei permite, o Orçô e o seu mantenedor não respondem por lucros perdidos,
          negócios não fechados, perda de dados ou outros prejuízos indiretos causados pelo uso do
          Orçô ou pela impossibilidade de usá-lo.
        </p>
      </section>

      <section>
        <h2>12. Encerramento do serviço</h2>
        <p>
          O Orçô pode deixar de existir. Se isso acontecer, avisaremos com pelo menos 30 dias de
          antecedência, para você baixar os PDFs dos seus orçamentos.
        </p>
      </section>

      <section>
        <h2>13. Mudanças nestes termos</h2>
        <p>
          Estes termos podem mudar. A versão nova é publicada nesta página, com a data no topo, e
          vale dali para frente: continuar usando o Orçô depois disso significa concordar com ela.
        </p>
      </section>

      <section>
        <h2>14. Lei e foro</h2>
        <p>
          Estes termos seguem a lei brasileira. Qualquer disputa será resolvida no foro do domicílio
          de quem usa o Orçô.
        </p>
      </section>
    </LegalPage>
  );
}
