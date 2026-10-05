import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/components/legal-page";
import { CONTACT_EMAIL, CONTROLLER_NAME, TERMS_UPDATED_AT } from "@/features/legal/constants";
import { MAX_CATALOG_ITEMS_PER_USER } from "@/lib/db/schema/catalog-items";
import { MAX_CLIENTS_PER_USER } from "@/lib/db/schema/clients";
import { MAX_ITEMS_PER_QUOTE, MAX_QUOTES_PER_MONTH } from "@/lib/db/schema/quote-limits";

export const metadata: Metadata = { title: "Termos de uso" };

// Termos de uso (RF-34, NBB-30 T7). Os limites vêm das mesmas constantes que o banco confere (RN-38).
// Mudou algo relevante? Atualize a data em constants.ts e avise por e-mail com 15 dias (item 10).

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
        <h2>3. Disponibilidade</h2>
        <p>
          Fazemos o possível para o Orçô funcionar sempre, mas não há garantia de disponibilidade
          contínua: pode haver falhas e pausas para manutenção. Fazemos cópias de segurança
          periódicas, mas recomendamos guardar o PDF dos orçamentos importantes.
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
          conta quando quiser, no Perfil: os dados são apagados na hora, e as cópias de segurança
          antigas são substituídas com o tempo.
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
        <h2>10. Mudanças nestes termos</h2>
        <p>
          Se estes termos mudarem de forma relevante, avisaremos por e-mail com pelo menos 15 dias
          de antecedência. Ajustes só de redação não são avisados. A data da última atualização fica
          no topo da página.
        </p>
      </section>

      <section>
        <h2>11. Lei e foro</h2>
        <p>
          Estes termos seguem a lei brasileira. Qualquer disputa será resolvida no foro do domicílio
          de quem usa o Orçô.
        </p>
      </section>
    </LegalPage>
  );
}
