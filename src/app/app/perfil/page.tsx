import type { Metadata } from "next";

import { DeleteAccount } from "@/features/auth/components/delete-account";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { logoUrl } from "@/features/profile/logo-rules";
import { getProfile } from "@/features/profile/profile";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil" };

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

// "Novidades" (F-14): as notas da versão no GitHub Releases. Numa versão publicada (vX.Y.Z), a página
// dela; no staging e no local, que não têm versão publicada, a lista de versões.
const RELEASES_URL = "https://github.com/nbbrdev/orco/releases";
const RELEASE_NOTES_URL = /^v\d+\.\d+\.\d+$/.test(APP_VERSION)
  ? `${RELEASES_URL}/tag/${APP_VERSION}`
  : RELEASES_URL;

// Perfil do freelancer (F-14, NBB-42), logo (NBB-81) e exclusão de conta (F-17, NBB-43). Tudo
// opcional e salvo campo a campo. Ficam para outras issues (D6): a aparência (NBB-60), o push e o
// "Instalar".
export default async function ProfilePage() {
  const user = await requireSessionUser();
  const { logoPath, ...profile } = await getProfile(user.id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Perfil</h1>

      <ProfileForm
        initial={profile}
        initialLogoUrl={logoPath ? logoUrl(logoPath) : null}
        accountEmail={user.email}
      />

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-base font-medium">
          Conta
        </h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div>
          <SignOutButton />
        </div>
        <DeleteAccount />
      </section>

      <p className="text-xs text-muted-foreground">
        Orçô {APP_VERSION} ·{" "}
        <a
          href={RELEASE_NOTES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Novidades
        </a>
      </p>
    </div>
  );
}
