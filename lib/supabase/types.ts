/**
 * Tipos del esquema `public` (v5).
 *
 * Cuando el proyecto Supabase esté aplicado, se pueden regenerar con:
 *   npx supabase gen types typescript --project-id chzzzvyljkqsofpjyqgr > lib/supabase/types.ts
 * (requiere SUPABASE_ACCESS_TOKEN — PAT).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -------- Enums --------
export type TipoMovimiento =
  | "saldo_apertura"
  | "ingreso"
  | "gasto"
  | "transferencia_interna"
  | "aporte_enviado"
  | "aporte_recibido";

export type NaturalezaAporte =
  | "prestamo"
  | "pago_deuda"
  | "reembolso"
  | "cooperacion";

export type EstadoMovimiento =
  | "pendiente_aprobacion"
  | "activo"
  | "rechazado"
  | "anulado";

export type CanalNotificacion = "email" | "telegram" | "whatsapp";
export type ModoCierre = "automatico" | "manual";
export type EstadoSolicitudAnulacion = "pendiente" | "aprobada" | "rechazada";

// -------- Row types --------
export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  avatar_url: string | null;
  es_admin: boolean;
  activo: boolean;
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
  parent_id: string | null;
  assigned_by_admin: string | null;
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
  fecha_solicitud: string;
  fecha_ejecucion: string | null;
  estado: EstadoMovimiento;
  autor_id: string;
  created_at: string;
  updated_at: string;
  aprobado_por: string | null;
  aprobado_at: string | null;
  motivo_rechazo: string | null;
  anulado_at: string | null;
  anulado_por: string | null;
  motivo_anulacion: string | null;
  transfer_id: string | null;
  aporte_id: string | null;
  prestamo_id: string | null;
  plazo_dias: number | null;
  fecha_vencimiento: string | null;
  naturaleza_aporte: NaturalezaAporte | null;
  contraparte_bolsa_id: string | null;
  contraparte_usuario_id: string | null;
  mes_contable: string;
  cerrado: boolean;
}

// Loose Database type para satisfacer supabase-js
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
      config_global: LooseTable;
      canales_notificacion: LooseTable;
      suscripciones_evento: LooseTable;
      bolsas: LooseTable;
      bolsa_miembros: LooseTable;
      categorias: LooseTable;
      movimientos: LooseTable;
      movimiento_adjuntos: LooseTable;
      movimientos_recurrentes: LooseTable;
      solicitudes_anulacion: LooseTable;
      cierres_mensuales: LooseTable;
      plantillas_reporte: LooseTable;
      auditoria: LooseTable;
    };
    Views: {
      v_saldos_bolsa: { Row: Record<string, unknown>; Relationships: [] };
      v_resumen_mensual_bolsa: { Row: Record<string, unknown>; Relationships: [] };
      v_contribuciones_bolsa_general: { Row: Record<string, unknown>; Relationships: [] };
      v_prestamos_activos: { Row: Record<string, unknown>; Relationships: [] };
      v_deudas_entre_usuarios: { Row: Record<string, unknown>; Relationships: [] };
    };
    Functions: {
      saldo_bolsa: { Args: { p_bolsa_id: string }; Returns: string | null };
      saldo_total_bolsa: { Args: { p_bolsa_id: string }; Returns: string | null };
      es_admin: { Args: Record<string, never>; Returns: boolean };
      es_miembro_bolsa: { Args: { p_bolsa_id: string }; Returns: boolean };
      es_bolsa_asignada: { Args: { p_bolsa_id: string }; Returns: boolean };
      crear_bolsa_propia: {
        Args: {
          p_nombre: string;
          p_descripcion: string | null;
          p_color: string;
          p_icono: string | null;
          p_moneda: string;
          p_saldo_inicial: number;
          p_permite_saldo_negativo: boolean;
          p_meta_habilitada: boolean;
          p_meta_monto: number | null;
          p_meta_fecha: string | null;
          p_parent_id: string | null;
        };
        Returns: string;
      };
      asignar_bolsa_a_usuario: {
        Args: {
          p_nombre: string;
          p_descripcion: string | null;
          p_color: string;
          p_icono: string | null;
          p_moneda: string;
          p_usuario_asignado: string;
          p_saldo_inicial: number;
          p_permite_saldo_negativo: boolean;
        };
        Returns: string;
      };
      crear_bolsa_general: {
        Args: {
          p_nombre?: string;
          p_color?: string;
          p_icono?: string;
          p_moneda?: string;
          p_co_owners?: string[];
        };
        Returns: string;
      };
      registrar_movimiento: {
        Args: {
          p_bolsa_id: string;
          p_tipo: TipoMovimiento;
          p_monto: number;
          p_categoria_id: string | null;
          p_descripcion: string | null;
          p_fecha_ejecucion?: string;
        };
        Returns: string;
      };
      aprobar_movimiento: { Args: { p_movimiento_id: string }; Returns: undefined };
      rechazar_movimiento: { Args: { p_movimiento_id: string; p_motivo: string }; Returns: undefined };
      crear_aporte: {
        Args: {
          p_bolsa_origen: string;
          p_bolsa_destino: string;
          p_monto: number;
          p_naturaleza: NaturalezaAporte;
          p_descripcion: string;
          p_plazo_dias?: number;
          p_prestamo_id?: string;
          p_fecha_ejecucion?: string;
        };
        Returns: string;
      };
      listar_destinos_aporte: {
        Args: Record<string, never>;
        Returns: {
          bolsa_id: string;
          nombre: string;
          moneda: string;
          usuario_id: string;
          usuario_nombre: string;
          es_general: boolean;
        }[];
      };
      mis_prestamos: {
        Args: Record<string, never>;
        Returns: {
          prestamo_id: string;
          acreedor_id: string;
          acreedor_nombre: string;
          deudor_id: string;
          deudor_nombre: string;
          bolsa_origen_id: string;
          bolsa_destino_id: string;
          monto_original: number;
          monto_pagado: number;
          saldo_pendiente: number;
          plazo_dias: number;
          fecha_ejecucion: string;
          fecha_vencimiento: string;
          estado_vencimiento: string;
          descripcion: string;
          moneda: string;
          rol: string;
        }[];
      };
      cancelar_aporte_pendiente: { Args: { p_aporte_id: string }; Returns: undefined };
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
      anular_movimiento: { Args: { p_movimiento_id: string; p_motivo: string }; Returns: undefined };
      archivar_bolsa: { Args: { p_bolsa_id: string }; Returns: undefined };
      actualizar_umbral_saldo_bajo: { Args: { p_pct: number }; Returns: undefined };
    };
    Enums: {
      tipo_movimiento: TipoMovimiento;
      naturaleza_aporte: NaturalezaAporte;
      estado_movimiento: EstadoMovimiento;
      canal_notificacion: CanalNotificacion;
      modo_cierre: ModoCierre;
      estado_solicitud_anulacion: EstadoSolicitudAnulacion;
    };
    CompositeTypes: Record<string, never>;
  };
}
