"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Method = "password" | "magic";

const passwordSchema = z.object({
  email: z.string().min(1, "Escribe tu correo").email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

const magicSchema = z.object({
  email: z.string().min(1, "Escribe tu correo").email("Correo inválido"),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof passwordSchema>;

export function LoginForm() {
  const [method, setMethod] = React.useState<Method>("password");
  const [sent, setSent] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(method === "password" ? passwordSchema : magicSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    form.clearErrors();
  }, [method, form]);

  const onSubmit = async (values: FormValues) => {
    const supabase = createClient();

    if (method === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password ?? "",
      });
      if (error) {
        toast.error("No pudimos iniciar sesión", { description: error.message });
        return;
      }
      toast.success("Bienvenido");
      // Hard navigation so middleware picks up the session cookie reliably.
      window.location.assign("/dashboard");
      return;
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });

    if (error) {
      toast.error("No pudimos enviar el enlace", { description: error.message });
      return;
    }

    setSent(values.email);
    toast.success("Revisa tu correo");
  };

  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="font-semibold">Revisa tu correo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviamos un enlace mágico a{" "}
          <span className="font-medium text-foreground">{sent}</span>. Haz clic
          en él para entrar.
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => setSent(null)}
          type="button"
        >
          Usar otro correo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md py-1.5 font-medium transition-colors",
            method === "password"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Contraseña
        </button>
        <button
          type="button"
          onClick={() => setMethod("magic")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md py-1.5 font-medium transition-colors",
            method === "magic"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Enlace mágico
        </button>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {method === "password" && (
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {method === "password" ? "Entrando..." : "Enviando..."}
            </>
          ) : method === "password" ? (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Entrar
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Enviar enlace mágico
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {method === "password"
            ? "Inicia sesión con el correo y la contraseña de tu cuenta."
            : "Usa esta opción si tu correo es real y quieres recibir un enlace."}
        </p>
      </form>
    </div>
  );
}
