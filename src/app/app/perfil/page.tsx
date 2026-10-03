import type { Metadata } from "next";

import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ProfileForm } from "@/features/profile/components/profile-form";
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

// Perfil do freelancer (F-14, NBB-42). Tudo opcional e salvo campo a campo. Ficam para outras
// issues (D6): o logo, a aparência (NBB-60), o push e o "Instalar" e a exclusão de conta (NBB-43).
export default async function ProfilePage() {
  const user = await requireSessionUser();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Perfil</h1>

      <ProfileForm initial={profile} accountEmail={user.email} />

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-base font-medium">
          Conta
        </h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div>
          <SignOutButton />
        </div>
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
