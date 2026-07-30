/**
 * Tipos manuales del esquema `public`.
 *
 * Regenerar cuando se agreguen migraciones:
 *   npx supabase gen types typescript --project-id chzzzvyljkqsofpjyqgr > lib/supabase/types.ts
 *
 * (requiere SUPABASE_ACCESS_TOKEN — Personal Access Token de la cuenta)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -----------------------------------------------------------------
// Enums públicos (usables directamente en la app).
// -----------------------------------------------------------------
export type TipoMovimiento =
  | "saldo_apertura"
  | "ingreso"
  | "gasto"
  | "transferencia_interna"
  | "aporte_recibido"
  | "aporte_enviado"
  | "retiro_externo";

export type NaturalezaAporte =
  | "prestamo"
  | "pago_deuda"
  | "reembolso"
  | "cooperacion"
  | "adelanto";

export type EstadoMovimiento = "activo" | "anulado";
export type CanalNotificacion = "email" | "telegram" | "whatsapp";
export type ModoCierre = "automatico" | "manual";
export type RolBolsa = "dueno" | "co_dueno";
export type EstadoSolicitudAnulacion = "pendiente" | "aprobada" | "rechazada";

// -----------------------------------------------------------------
// Row types "de vista" (usados en componentes/consultas).
// -----------------------------------------------------------------
export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bolsa {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  moneda: string;
  es_general: boolean;
  archivada: boolean;
  archivada_at: string | null;
  permite_saldo_negativo: boolean;
  meta_habilitada: boolean;
  meta_monto: string | null;
  meta_fecha: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Movimiento {
  id: string;
  bolsa_id: string;
  tipo: TipoMovimiento;
  monto: string;
  moneda: string;
  categoria_id: string | null;
  descripcion: string | null;
  fecha_movimiento: string;
  estado: EstadoMovimiento;
  autor_id: string;
  created_at: string;
  updated_at: string;
  anulado_at: string | null;
  anulado_por: string | null;
  motivo_anulacion: string | null;
  transfer_id: string | null;
  aporte_id: string | null;
  naturaleza_aporte: NaturalezaAporte | null;
  contraparte_bolsa_id: string | null;
  contraparte_usuario_id: string | null;
  mes_contable: string;
  cerrado: boolean;
}

// -----------------------------------------------------------------
// Shape de Database para supabase-js. Usa `Json` amplio para no pelear
// con el sistema de tipos del SDK; el tipado fuerte lo obtenemos en
// consulta con `.returns<Bolsa[]>()` / `.select<...>()`.
// -----------------------------------------------------------------
type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      perfiles: LooseTable;
      preferencias_usuario: LooseTable;
      canales_notificacion: LooseTable;
      suscripciones_evento: LooseTable;
      bolsas: LooseTable;
      bolsa_miembros: LooseTable;
      categorias: LooseTable;
      movimientos: LooseTable;
      movimiento_adjuntos: LooseTable;
      movimientos_recurrentes: LooseTable;
      presupuestos: LooseTable;
      solicitudes_anulacion: LooseTable;
      cierres_mensuales: LooseTable;
      auditoria: LooseTable;
    };
    Views: {
      v_saldos_bolsa: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
      v_resumen_mensual_bolsa: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
      v_contribuciones_bolsa_general: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
      v_deudas_entre_usuarios: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      saldo_bolsa: {
        Args: { p_bolsa_id: string };
        Returns: string | null;
      };
      crear_transferencia_interna: {
        Args: {
          p_bolsa_origen: string;
          p_bolsa_destino: string;
          p_monto: number;
          p_descripcion?: string;
          p_fecha?: string;
        };
        Returns: string;
      };
      crear_aporte: {
        Args: {
          p_bolsa_origen: string;
          p_bolsa_destino: string;
          p_monto: number;
          p_naturaleza: NaturalezaAporte;
          p_descripcion: string;
          p_fecha?: string;
        };
        Returns: string;
      };
      anular_movimiento: {
        Args: { p_movimiento_id: string; p_motivo: string };
        Returns: undefined;
      };
      archivar_bolsa: {
        Args: { p_bolsa_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      tipo_movimiento: TipoMovimiento;
      naturaleza_aporte: NaturalezaAporte;
      estado_movimiento: EstadoMovimiento;
      canal_notificacion: CanalNotificacion;
      modo_cierre: ModoCierre;
      rol_bolsa: RolBolsa;
      estado_solicitud_anulacion: EstadoSolicitudAnulacion;
    };
    CompositeTypes: Record<string, never>;
  };
}
