"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z
    .string()
    .min(1, "Escribe tu correo")
    .email("Correo inválido"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [sent, setSent] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      toast.error("No pudimos enviar el enlace", { description: error.message });
      return;
    }

    setSent(values.email);
    toast.success("Revisa tu correo", {
      description: "Te enviamos un enlace para entrar.",
    });
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
          en él para entrar. El enlace expira pronto.
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

      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Enviar enlace mágico
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Al continuar aceptas que el sistema registrará tus acciones para
        auditoría contable.
      </p>
    </form>
  );
}
