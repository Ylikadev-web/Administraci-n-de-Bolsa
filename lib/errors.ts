export function humanizeSupabaseError(message: string | null | undefined): {
  title: string;
  detail: string;
  isSession: boolean;
} {
  const raw = (message ?? "").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("jwt issued at future") ||
    lower.includes("issued at future") ||
    lower.includes("token is not yet valid")
  ) {
    return {
      title: "Sesión inválida por la hora del equipo",
      detail:
        "El reloj de tu PC está desfasado respecto a internet. En Windows: Configuración → Hora e idioma → activa «Ajustar la hora automáticamente», luego cierra sesión y vuelve a entrar.",
      isSession: true,
    };
  }

  if (
    lower.includes("jwt expired") ||
    lower.includes("invalid jwt") ||
    lower.includes("bad_jwt")
  ) {
    return {
      title: "Tu sesión expiró",
      detail: "Cierra sesión y vuelve a entrar para continuar.",
      isSession: true,
    };
  }

  return {
    title: "No pudimos cargar las bolsas.",
    detail: raw || "Error desconocido",
    isSession: false,
  };
}
