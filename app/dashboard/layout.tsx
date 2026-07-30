import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { UserAvatar } from "@/app/dashboard/user-avatar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle<{ nombre: string; email: string; avatar_url: string | null }>();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary" />
            <span className="font-semibold tracking-tight">Bolsas</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserAvatar
              nombre={perfil?.nombre ?? user.email ?? "Usuario"}
              email={perfil?.email ?? user.email ?? ""}
              avatarUrl={perfil?.avatar_url ?? null}
            />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="container py-6 md:py-10">{children}</main>
    </div>
  );
}
