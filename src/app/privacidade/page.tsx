import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/features/legal/components/legal-page";
import { CONTACT_EMAIL, CONTROLLER_NAME, PRIVACY_UPDATED_AT } from "@/features/legal/constants";

export const metadata: Metadata = { title: "Política de privacidade" };

// Política de privacidade (RF-34, LGPD, NBB-30). Prazos e dados conferidos no código e em
// docs/07-seguranca.md §13; mudou algo lá, mude aqui (e a data em constants.ts).
export default function PrivacyPage() {
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <LegalPage title="Política de privacidade" updatedAt={PRIVACY_UPDATED_AT}>
      <section>
        <p>
          Esta política explica quais dados pessoais o Orçô trata, para quê, por quanto tempo e
          quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei
          13.709/2018, a LGPD).
        </p>
      </section>

      <section>
        <h2>1. Quem é o responsável</h2>
        <p>
          O Orçô é mantido por <strong>{CONTROLLER_NAME}</strong>, responsável (controlador) pelos
          dados das contas. Para qualquer assunto sobre os seus dados, escreva para {email}.
        </p>
      </section>

      <section>
        <h2>2. Dois papéis diferentes</h2>
        <ul>
          <li>
            <strong>Quem tem conta (o profissional):</strong> o Orçô decide como trata os seus dados
            de cadastro e de uso. Aqui, o Orçô é o controlador.
          </li>
          <li>
            <strong>Os clientes do profissional:</strong> quando um profissional cadastra um cliente
            ou envia um orçamento, quem decide sobre esses dados é o profissional. Ele é o
            controlador, e o Orçô só guarda e processa os dados em nome dele (operador). Se você
            recebeu um orçamento e tem uma dúvida sobre os seus dados, fale primeiro com quem o
            enviou; se precisar, escreva também para {email}.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Quais dados tratamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> e-mail, nome e senha (guardada só como código irreversível,
            nunca o texto). No login com o Google, só o e-mail e o nome; a foto não é guardada.
          </li>
          <li>
            <strong>Sessão de login:</strong> o endereço IP e o navegador de onde você entrou.
          </li>
          <li>
            <strong>Perfil (opcional):</strong> nome, nome comercial, CPF ou CNPJ, telefone, e-mail
            de contato, site, Instagram, dados de pagamento e logo, que aparecem nos seus
            orçamentos.
          </li>
          <li>
            <strong>Clientes e orçamentos:</strong> o que você cadastra dos seus clientes (nome,
            e-mail, telefone, CPF ou CNPJ, endereço e anotações) e os orçamentos.
          </li>
          <li>
            <strong>Link do orçamento:</strong> quando o cliente abre o link, aprova ou recusa,
            guardamos a data, o endereço IP, o navegador e, se ele informar, o nome (na aprovação)
            ou o motivo (na recusa). Isso serve de registro do aceite.
          </li>
          <li>
            <strong>Notificações:</strong> se você ativar o push, o endereço que o navegador do seu
            aparelho cria para receber avisos.
          </li>
          <li>
            <strong>Segurança:</strong> endereços IP usados para limitar abusos (como muitas
            tentativas de cadastro) e registrados nos acessos ao servidor.
          </li>
        </ul>
        <p>
          O Orçô não usa cookies de publicidade nem de análise. O único cookie é o da sessão de
          login, necessário para você continuar conectado.
        </p>
      </section>

      <section>
        <h2>4. Para que usamos e com que base legal</h2>
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (conta, perfil, clientes, orçamentos, PDF, link,
            avisos por e-mail e push): execução do contrato com você, os{" "}
            <Link href="/termos">Termos de uso</Link>.
          </li>
          <li>
            <strong>Segurança e prevenção de abusos</strong> (IP, navegador, limites de uso):
            legítimo interesse.
          </li>
          <li>
            <strong>Registro do aceite do orçamento</strong> (data, IP e navegador de quem aprova ou
            recusa): legítimo interesse do profissional e do cliente em ter uma prova simples do que
            foi combinado.
          </li>
        </ul>
        <p>Não vendemos dados, não fazemos publicidade e não traçamos perfis.</p>
      </section>

      <section>
        <h2>5. Com quem compartilhamos</h2>
        <p>Só com os serviços necessários para o Orçô funcionar:</p>
        <ul>
          <li>
            <strong>Hostinger</strong>: o servidor onde o Orçô e o banco de dados ficam, no Brasil,
            e o DNS do domínio.
          </li>
          <li>
            <strong>Resend</strong> (Estados Unidos): envio dos e-mails do Orçô (confirmação de
            cadastro, troca de senha e avisos de resposta e de vencimento).
          </li>
          <li>
            <strong>Google</strong>: o login com o Google, se você escolher, e a entrega das
            notificações push em navegadores Chrome e no Android.
          </li>
          <li>
            <strong>Apple</strong> e <strong>Mozilla</strong>: a entrega das notificações push no
            iPhone e no Firefox. O conteúdo da notificação vai criptografado; elas só repassam.
          </li>
        </ul>
        <p>
          O envio de e-mails pela Resend é uma transferência internacional de dados (LGPD, art. 33),
          feita para cumprir o contrato com você. Fora isso, os dados só são compartilhados se uma
          lei ou ordem judicial exigir.
        </p>
      </section>

      <section>
        <h2>6. Por quanto tempo guardamos</h2>
        <ul>
          <li>
            <strong>Conta, perfil, clientes e orçamentos:</strong> até você excluir a conta. A
            exclusão apaga tudo na hora.
          </li>
          <li>
            <strong>IP dos registros do link do orçamento:</strong> 12 meses; depois, o IP é apagado
            e fica só o restante do registro.
          </li>
          <li>
            <strong>Sessões de login:</strong> até expirarem; as expiradas são apagadas diariamente.
          </li>
          <li>
            <strong>IP usado nos limites de uso:</strong> até 2 dias.
          </li>
          <li>
            <strong>Registros de acesso do servidor:</strong> até 14 dias.
          </li>
          <li>
            <strong>Cópias de segurança (backups):</strong> guardadas com acesso restrito e
            substituídas periodicamente.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>
          Você pode, a qualquer momento, pedir para confirmar se tratamos seus dados, acessá-los,
          corrigi-los, levá-los a outro serviço (portabilidade), excluí-los e saber com quem foram
          compartilhados, além de revogar consentimentos e se opor a um tratamento (LGPD, art. 18).
        </p>
        <ul>
          <li>
            Boa parte você faz sozinho no app: corrigir o perfil, os clientes e os orçamentos, e
            excluir a conta inteira no Perfil.
          </li>
          <li>Para o resto, escreva para {email}. Respondemos em até 15 dias.</li>
          <li>
            Se não ficar satisfeito, você também pode reclamar à Autoridade Nacional de Proteção de
            Dados (ANPD).
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Segurança</h2>
        <p>
          Usamos conexão criptografada (HTTPS), senhas guardadas só como código irreversível,
          separação dos dados de cada conta no próprio banco de dados, limites contra abusos e
          acesso restrito ao servidor. Nenhum sistema é 100% seguro: se acontecer um incidente que
          possa trazer risco a você, avisaremos você e a ANPD, como a LGPD manda.
        </p>
      </section>

      <section>
        <h2>9. Menores de idade</h2>
        <p>
          O Orçô é para uso profissional e não se destina a menores de 18 anos. Uma conta não pode
          ser criada por eles.
        </p>
      </section>

      <section>
        <h2>10. Mudanças nesta política</h2>
        <p>
          Se esta política mudar de forma relevante, avisaremos por e-mail com pelo menos 15 dias de
          antecedência. Ajustes só de redação não mudam o que está combinado e não são avisados. A
          data da última atualização fica no topo da página.
        </p>
      </section>
    </LegalPage>
  );
}
