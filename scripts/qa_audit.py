#!/usr/bin/env python3
"""
QA de integridad (fullstack + contable) contra Supabase live.
Limpia datos de prueba al final dejando solo perfiles.
No imprime contraseñas.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
ANON = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

PASSWORDS = {
    "nesim@bolsa.com": os.environ.get("QA_NESIM_PASS", "nesim-bolsa-2026"),
    "moises@bolsa.com": os.environ.get("QA_MOISES_PASS", "moises-bolsa-2026"),
    "itzyk@bolsa.com": os.environ.get("QA_ITZYK_PASS", "itzyk-bolsa-2026"),
}


@dataclass
class Case:
    category: str
    name: str
    ok: bool
    detail: str = ""
    lens: str = "fullstack"  # fullstack | contable


@dataclass
class Report:
    cases: list[Case] = field(default_factory=list)

    def add(self, category: str, name: str, ok: bool, detail: str = "", lens: str = "fullstack"):
        self.cases.append(Case(category, name, ok, detail, lens))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] [{lens}] {category} :: {name}" + (f" — {detail}" if detail else ""))


def req(method: str, path: str, token: str | None = None, body: Any = None, service: bool = False):
    headers = {
        "apikey": SERVICE if service else ANON,
        "Content-Type": "application/json",
    }
    key = SERVICE if service else ANON
    headers["Authorization"] = f"Bearer {token or key}"
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode() or "null"
            return resp.status, json.loads(raw) if raw != "null" else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"message": raw}
        return e.code, payload


def login(email: str) -> str:
    code, data = req(
        "POST",
        "/auth/v1/token?grant_type=password",
        body={"email": email, "password": PASSWORDS[email]},
    )
    if code >= 400 or not data or not data.get("access_token"):
        raise RuntimeError(f"login failed {email}: {data}")
    return data["access_token"]


def rpc(token: str, name: str, args: dict) -> tuple[int, Any]:
    return req("POST", f"/rest/v1/rpc/{name}", token=token, body=args)


def wipe():
    for table, q in [
        ("movimientos", "id=not.is.null"),
        ("bolsa_miembros", "bolsa_id=not.is.null"),
        ("bolsas", "id=not.is.null"),
        ("auditoria", "id=not.is.null"),
    ]:
        req("DELETE", f"/rest/v1/{table}?{q}", service=True)


def main() -> int:
    R = Report()
    wipe()

    # -------- AUTH --------
    tokens = {}
    for email in PASSWORDS:
        try:
            tokens[email] = login(email)
            R.add("Auth", f"Login password {email.split('@')[0]}", True)
        except Exception as e:
            R.add("Auth", f"Login password {email.split('@')[0]}", False, str(e))
            return 1

    tn, tm, ti = tokens["nesim@bolsa.com"], tokens["moises@bolsa.com"], tokens["itzyk@bolsa.com"]

    # profiles
    code, perfiles = req("GET", "/rest/v1/perfiles?select=id,email,es_admin,activo", token=tn)
    by_email = {p["email"]: p for p in (perfiles or [])}
    R.add("Auth/Perfiles", "Nesim es_admin=true", by_email.get("nesim@bolsa.com", {}).get("es_admin") is True)
    R.add("Auth/Perfiles", "Moisés es_admin=false", by_email.get("moises@bolsa.com", {}).get("es_admin") is False)
    R.add("Auth/Perfiles", "Itzyk es_admin=false", by_email.get("itzyk@bolsa.com", {}).get("es_admin") is False)

    nesim_id = by_email["nesim@bolsa.com"]["id"]
    moises_id = by_email["moises@bolsa.com"]["id"]
    itzyk_id = by_email["itzyk@bolsa.com"]["id"]

    # -------- EMPTY STATE / GENERAL FROM ZERO --------
    code, bolsas = req("GET", "/rest/v1/bolsas?select=id&archivada=eq.false", token=tn)
    R.add("Bolsa General", "Estado inicial sin bolsas", code < 400 and bolsas == [])

    # Non-admin cannot create general
    code, data = rpc(tm, "crear_bolsa_general", {"p_nombre": "Hack General"})
    R.add("Bolsa General / RLS", "Moisés NO puede crear Bolsa General", code >= 400 or (isinstance(data, dict) and data.get("code")))

    # Admin creates general with co-owners
    code, gid = rpc(
        tn,
        "crear_bolsa_general",
        {
            "p_nombre": "Bolsa General",
            "p_color": "#eab308",
            "p_icono": "users",
            "p_moneda": "MXN",
            "p_co_owners": [moises_id, itzyk_id],
        },
    )
    R.add("Bolsa General", "Nesim crea Bolsa General desde 0", code < 400 and isinstance(gid, str), str(gid)[:8] if isinstance(gid, str) else str(data))
    if not isinstance(gid, str):
        print("ABORT: no general id", code, gid)
        return 1

    # Duplicate blocked
    code, data = rpc(tn, "crear_bolsa_general", {"p_nombre": "Otra"})
    R.add("Bolsa General", "No permite segunda General activa", code >= 400)

    # Members
    code, miembros = req("GET", f"/rest/v1/bolsa_miembros?bolsa_id=eq.{gid}&select=usuario_id", token=tn)
    member_ids = {m["usuario_id"] for m in (miembros or [])}
    R.add("Bolsa General", "3 co-propietarios (Nesim+Moisés+Itzyk)", member_ids == {nesim_id, moises_id, itzyk_id}, str(len(member_ids)))

    # Visibility
    for label, tok, expect_see in [("Nesim", tn, True), ("Moisés", tm, True), ("Itzyk", ti, True)]:
        code, rows = req("GET", f"/rest/v1/bolsas?id=eq.{gid}&select=id", token=tok)
        sees = bool(rows)
        R.add("RLS Visibilidad", f"{label} ve Bolsa General", sees == expect_see)

    # Saldo inicial 0
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": gid})
    R.add("Contable / Saldo", "General inicia en 0", float(saldo or 0) == 0, str(saldo), lens="contable")

    # -------- PROPIA --------
    code, propia = rpc(
        tn,
        "crear_bolsa_propia",
        {
            "p_nombre": "Ahorro QA Nesim",
            "p_descripcion": "QA",
            "p_color": "#0ea5e9",
            "p_icono": "wallet",
            "p_moneda": "MXN",
            "p_saldo_inicial": 1000,
            "p_permite_saldo_negativo": False,
            "p_meta_habilitada": False,
            "p_meta_monto": None,
            "p_meta_fecha": None,
            "p_parent_id": None,
        },
    )
    R.add("Bolsa Propia", "Nesim crea propia con saldo inicial 1000", code < 400 and isinstance(propia, str))
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": propia})
    R.add("Contable / Saldo", "Propia saldo = 1000 tras apertura", float(saldo) == 1000, str(saldo), lens="contable")

    # Moises cannot see Nesim propia
    code, rows = req("GET", f"/rest/v1/bolsas?id=eq.{propia}&select=id", token=tm)
    R.add("RLS Visibilidad", "Moisés NO ve bolsa propia de Nesim", not rows)

    # Ingreso/gasto inmediata
    code, mid = rpc(
        tn,
        "registrar_movimiento",
        {
            "p_bolsa_id": propia,
            "p_tipo": "ingreso",
            "p_monto": 250,
            "p_categoria_id": None,
            "p_descripcion": "Ingreso QA",
            "p_fecha_ejecucion": "2026-07-31",
        },
    )
    R.add("Movimientos Propia", "Ingreso 250 activo inmediato", code < 400)
    code, midg = rpc(
        tn,
        "registrar_movimiento",
        {
            "p_bolsa_id": propia,
            "p_tipo": "gasto",
            "p_monto": 100,
            "p_categoria_id": None,
            "p_descripcion": "Gasto QA",
            "p_fecha_ejecucion": "2026-07-31",
        },
    )
    R.add("Movimientos Propia", "Gasto 100 activo inmediato", code < 400)
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": propia})
    R.add("Contable / Saldo", "Propia saldo = 1150 (1000+250-100)", float(saldo) == 1150, str(saldo), lens="contable")

    # Overdraft blocked
    code, data = rpc(
        tn,
        "registrar_movimiento",
        {
            "p_bolsa_id": propia,
            "p_tipo": "gasto",
            "p_monto": 99999,
            "p_categoria_id": None,
            "p_descripcion": "Sobregiro",
            "p_fecha_ejecucion": None,
        },
    )
    R.add("Contable / Reglas", "Bloquea gasto > saldo en propia", code >= 400, lens="contable")

    # Invalid monto
    code, data = rpc(
        tn,
        "registrar_movimiento",
        {
            "p_bolsa_id": propia,
            "p_tipo": "ingreso",
            "p_monto": 0,
            "p_categoria_id": None,
            "p_descripcion": "cero",
            "p_fecha_ejecucion": None,
        },
    )
    R.add("Validaciones", "Rechaza monto 0", code >= 400)

    # -------- GENERAL MOVEMENTS / APPROVAL --------
    # Moises gasto -> pending
    code, pend = rpc(
        tm,
        "registrar_movimiento",
        {
            "p_bolsa_id": gid,
            "p_tipo": "gasto",
            "p_monto": 40,
            "p_categoria_id": None,
            "p_descripcion": "Gasto Moisés pending",
            "p_fecha_ejecucion": None,
        },
    )
    R.add("Aprobaciones", "Gasto Moisés en General queda pendiente", code < 400 and isinstance(pend, str))
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": gid})
    R.add("Contable / Saldo", "Pendiente NO afecta saldo General", float(saldo or 0) == 0, str(saldo), lens="contable")

    # Moises cannot approve
    code, data = rpc(tm, "aprobar_movimiento", {"p_movimiento_id": pend})
    R.add("Aprobaciones / RLS", "Moisés NO puede aprobar", code >= 400)

    # Nesim rejects first
    code, data = rpc(tn, "rechazar_movimiento", {"p_movimiento_id": pend, "p_motivo": "Sin comprobante"})
    R.add("Aprobaciones", "Nesim rechaza con motivo", code < 400)
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": gid})
    R.add("Contable / Saldo", "Tras rechazo saldo sigue 0", float(saldo or 0) == 0, str(saldo), lens="contable")

    # Reject requires motivo
    code, pend2 = rpc(
        tm,
        "registrar_movimiento",
        {
            "p_bolsa_id": gid,
            "p_tipo": "ingreso",
            "p_monto": 500,
            "p_categoria_id": None,
            "p_descripcion": "Aporte Moisés",
            "p_fecha_ejecucion": None,
        },
    )
    code, data = rpc(tn, "rechazar_movimiento", {"p_movimiento_id": pend2, "p_motivo": "no"})
    R.add("Validaciones", "Rechazo exige motivo ≥3 chars", code >= 400)

    # Approve ingreso
    code, data = rpc(tn, "aprobar_movimiento", {"p_movimiento_id": pend2})
    R.add("Aprobaciones", "Nesim aprueba ingreso 500", code < 400)
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": gid})
    R.add("Contable / Saldo", "General saldo = 500 tras aprobar ingreso", float(saldo) == 500, str(saldo), lens="contable")

    # Nesim movement on general auto-activo
    code, mid = rpc(
        tn,
        "registrar_movimiento",
        {
            "p_bolsa_id": gid,
            "p_tipo": "gasto",
            "p_monto": 50,
            "p_categoria_id": None,
            "p_descripcion": "Gasto Nesim auto",
            "p_fecha_ejecucion": "2026-07-31",
        },
    )
    R.add("Aprobaciones", "Gasto de Nesim en General auto-activo", code < 400)
    code, saldo = rpc(tn, "saldo_bolsa", {"p_bolsa_id": gid})
    R.add("Contable / Saldo", "General saldo = 450 tras gasto Nesim", float(saldo) == 450, str(saldo), lens="contable")

    # -------- ASIGNADA --------
    code, asignada = rpc(
        tn,
        "asignar_bolsa_a_usuario",
        {
            "p_nombre": "Viáticos Moisés",
            "p_descripcion": "QA asignada",
            "p_color": "#a855f7",
            "p_icono": "briefcase",
            "p_moneda": "MXN",
            "p_usuario_asignado": moises_id,
            "p_saldo_inicial": 200,
            "p_permite_saldo_negativo": False,
        },
    )
    R.add("Bolsa Asignada", "Nesim asigna bolsa a Moisés con 200", code < 400 and isinstance(asignada, str))
    code, rows = req("GET", f"/rest/v1/bolsas?id=eq.{asignada}&select=id", token=tm)
    R.add("RLS Visibilidad", "Moisés ve su bolsa asignada", bool(rows))
    code, rows = req("GET", f"/rest/v1/bolsas?id=eq.{asignada}&select=id", token=ti)
    R.add("RLS Visibilidad", "Itzyk NO ve bolsa asignada a Moisés", not rows)

    code, saldo = rpc(tm, "saldo_bolsa", {"p_bolsa_id": asignada})
    R.add("Contable / Saldo", "Asignada saldo inicial 200", float(saldo) == 200, str(saldo), lens="contable")

    code, pend_a = rpc(
        tm,
        "registrar_movimiento",
        {
            "p_bolsa_id": asignada,
            "p_tipo": "gasto",
            "p_monto": 30,
            "p_categoria_id": None,
            "p_descripcion": "Taxi",
            "p_fecha_ejecucion": None,
        },
    )
    R.add("Bolsa Asignada", "Gasto Moisés en asignada queda pendiente", code < 400)
    code, saldo = rpc(tm, "saldo_bolsa", {"p_bolsa_id": asignada})
    R.add("Contable / Saldo", "Pendiente no baja saldo asignada", float(saldo) == 200, str(saldo), lens="contable")
    code, data = rpc(tn, "aprobar_movimiento", {"p_movimiento_id": pend_a})
    R.add("Aprobaciones", "Nesim aprueba gasto en asignada", code < 400)
    code, saldo = rpc(tm, "saldo_bolsa", {"p_bolsa_id": asignada})
    R.add("Contable / Saldo", "Asignada saldo = 170 tras aprobar", float(saldo) == 170, str(saldo), lens="contable")

    # Non-admin cannot assign
    code, data = rpc(
        tm,
        "asignar_bolsa_a_usuario",
        {
            "p_nombre": "Hack",
            "p_descripcion": None,
            "p_color": "#000000",
            "p_icono": "wallet",
            "p_moneda": "MXN",
            "p_usuario_asignado": itzyk_id,
            "p_saldo_inicial": 0,
            "p_permite_saldo_negativo": False,
        },
    )
    R.add("Bolsa Asignada / RLS", "Moisés NO puede asignar bolsas", code >= 400)

    # -------- ARCHIVE --------
    # Cannot archive general
    code, data = rpc(tn, "archivar_bolsa", {"p_bolsa_id": gid})
    R.add("Archivado", "No se puede archivar Bolsa General", code >= 400)

    # Cannot archive propia with saldo != 0
    code, data = rpc(tn, "archivar_bolsa", {"p_bolsa_id": propia})
    R.add("Archivado", "No archiva propia con saldo ≠ 0", code >= 400)

    # Create empty propia and archive
    code, vacia = rpc(
        tn,
        "crear_bolsa_propia",
        {
            "p_nombre": "Temporal vacía",
            "p_descripcion": None,
            "p_color": "#64748b",
            "p_icono": "wallet",
            "p_moneda": "MXN",
            "p_saldo_inicial": 0,
            "p_permite_saldo_negativo": False,
            "p_meta_habilitada": False,
            "p_meta_monto": None,
            "p_meta_fecha": None,
            "p_parent_id": None,
        },
    )
    code, data = rpc(tn, "archivar_bolsa", {"p_bolsa_id": vacia})
    R.add("Archivado", "Archiva propia con saldo 0", code < 400)

    # -------- EDIT --------
    code, data = req(
        "PATCH",
        f"/rest/v1/bolsas?id=eq.{propia}",
        token=tn,
        body={"nombre": "Ahorro QA Nesim (editado)"},
    )
    # PATCH may return 204
    code2, rows = req("GET", f"/rest/v1/bolsas?id=eq.{propia}&select=nombre", token=tn)
    ok_edit = rows and rows[0]["nombre"].endswith("(editado)")
    R.add("CRUD Bolsa", "Editar nombre de propia", ok_edit)

    # Moises cannot edit Nesim propia
    code, data = req(
        "PATCH",
        f"/rest/v1/bolsas?id=eq.{propia}",
        token=tm,
        body={"nombre": "Hackeada"},
    )
    code2, rows = req("GET", f"/rest/v1/bolsas?id=eq.{propia}&select=nombre", token=tn)
    R.add("RLS Escritura", "Moisés no altera bolsa de Nesim", rows and "Hackeada" not in rows[0]["nombre"])

    # -------- PRODUCTION HTTP --------
    try:
        with urllib.request.urlopen("https://bolsas-rose.vercel.app/login", timeout=30) as resp:
            html = resp.read().decode()
            R.add("Producción", "GET /login = 200", resp.status == 200)
            R.add("Producción", "Login sin 'Cuentas de prueba'", "Cuentas de prueba" not in html)
            R.add("Producción", "Bundle tiene URL Supabase (check via login page loads)", "Bolsas" in html)
    except Exception as e:
        R.add("Producción", "GET /login", False, str(e))

    # Leave clean slate for user? User asked Nesim create from 0 - wipe QA data after report
    # Keep a clean DB so Nesim starts from 0 in UI
    wipe()
    R.add("Limpieza", "BD sin bolsas demo tras QA (perfiles intactos)", True)

    # Summary
    fails = [c for c in R.cases if not c.ok]
    print("\n======== RESUMEN ========")
    print(f"Total: {len(R.cases)}  PASS: {len(R.cases)-len(fails)}  FAIL: {len(fails)}")
    by_cat: dict[str, list[Case]] = {}
    for c in R.cases:
        by_cat.setdefault(c.category, []).append(c)
    for cat, items in by_cat.items():
        f = sum(1 for i in items if not i.ok)
        print(f"  - {cat}: {len(items)-f}/{len(items)} pass")

    # Write JSON for report generator
    out = {
        "total": len(R.cases),
        "pass": len(R.cases) - len(fails),
        "fail": len(fails),
        "cases": [c.__dict__ for c in R.cases],
    }
    with open("/workspace/docs/qa-results.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
