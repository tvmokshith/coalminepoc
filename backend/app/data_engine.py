"""
Synthetic data engine — runs as a background asyncio task.
Generates realistic mining data with patterns, failures, and seasonal effects.
"""
from __future__ import annotations
import asyncio
import random
import math
import uuid
from datetime import datetime
from app.config import settings
from app.models import (
    KPIReading, KPIStatus, KPICategory, Alert, AlertSeverity,
    EquipmentStatus, MineStatus,
)
from app import state
from app.ai_engine import generate_advisory
from app.ws_manager import ws_manager

_tick = 0

# ── Alert type badges (mapped to different mine alert patterns) ──
_ALERT_TYPE_MAP = {
    "equipment_failure": "Equipment",
    "operational": "Operational",
    "thermal": "Thermal",
    "vibration": "Vibration",
    "overload": "Overload",
    "safety": "Safety",
    "environmental": "Environmental",
    "logistics": "Logistics",
}

_TEAM_ASSIGNMENTS = [
    "Alpha Shift", "Beta Shift", "Gamma Shift",
    "Maintenance Crew A", "Maintenance Crew B",
    "Emergency Response", "Safety Division", None,
]


def _status_for(value: float, green_above: float, red_below: float) -> KPIStatus:
    if value >= green_above:
        return KPIStatus.GREEN
    if value >= red_below:
        return KPIStatus.AMBER
    return KPIStatus.RED


def _inv_status(value: float, green_below: float, red_above: float) -> KPIStatus:
    """Inverted status — lower is better (e.g. downtime, cost)."""
    if value <= green_below:
        return KPIStatus.GREEN
    if value <= red_above:
        return KPIStatus.AMBER
    return KPIStatus.RED


def _add_history(mine_id: str, kpi_name: str, value: float, ts: str):
    hist = state.KPI_HISTORY[mine_id].setdefault(kpi_name, [])
    hist.append({"value": round(value, 2), "timestamp": ts})
    if len(hist) > 500:
        state.KPI_HISTORY[mine_id][kpi_name] = hist[-500:]


def _add_sensor_reading(eq_id: str, mine_id: str, ts: str, status: str, utilization: float):
    """Generate and store equipment sensor time-series data."""
    readings = state.EQUIPMENT_SENSORS.setdefault(eq_id, [])
    base_temp = 75 if status == "running" else (95 if status == "breakdown" else 45)
    base_vib = 3.5 if status == "running" else (8.0 if status == "breakdown" else 1.0)
    readings.append({
        "timestamp": ts,
        "temperature": round(_jitter(base_temp + utilization * 0.3, 0.06), 1),
        "vibration": round(_jitter(base_vib + (utilization - 60) * 0.05, 0.08), 2),
        "fuel_rate": round(_jitter(25 + utilization * 0.3, 0.05), 1) if status == "running" else 0,
        "pressure": round(_jitter(4.5 + utilization * 0.02, 0.04), 2),
        "load_pct": round(utilization, 1),
        "motor_current": round(_jitter(120 + utilization * 1.5, 0.05), 1) if status == "running" else 0,
        "oil_level": round(max(40, min(100, _jitter(85 - _tick * 0.01, 0.02))), 1),
        "cycle_time": round(_jitter(45 + (100 - utilization) * 0.5, 0.06), 1) if status == "running" else 0,
    })
    if len(readings) > 200:
        state.EQUIPMENT_SENSORS[eq_id] = readings[-200:]


def _maybe_add_anomaly(mine_id: str, kpi_name: str, value: float, status: KPIStatus, ts: str):
    """Record anomaly events for KPI readings that cross thresholds."""
    if status == KPIStatus.GREEN:
        return
    anomalies = state.KPI_ANOMALIES[mine_id].setdefault(kpi_name, [])
    if status == KPIStatus.RED:
        desc = f"{kpi_name} at {value:.1f} — crossed critical threshold at mine operations"
        sev = "critical"
    else:
        desc = f"{kpi_name} drifted to {value:.1f} — approaching warning band"
        sev = "warning"
    anomalies.append({"timestamp": ts, "severity": sev, "description": desc})
    if len(anomalies) > 50:
        state.KPI_ANOMALIES[mine_id][kpi_name] = anomalies[-50:]


def _jitter(base: float, pct: float = 0.05) -> float:
    return base * (1 + random.uniform(-pct, pct))


async def _update_cycle():
    global _tick
    _tick += 1
    state.ENGINE_TICK = _tick
    now = datetime.utcnow()
    ts = now.isoformat()
    hour = now.hour
    # Day/night factor: production higher 6am-6pm
    day_factor = 1.0 if 6 <= hour < 18 else 0.75
    # Seasonal rain factor (Jul-Sep)
    rain_factor = 0.85 if now.month in (7, 8, 9) else 1.0

    ws_updates = []

    for mine_id, mine in state.MINES.items():
        mine_eq = state.get_mine_equipment(mine_id)
        running_eq = [e for e in mine_eq if e.status == EquipmentStatus.RUNNING]
        total_eq = len(mine_eq)

        # ── Equipment simulation ───────────────────────
        for eq in mine_eq:
            # Random breakdown (1% chance per tick for running equipment)
            if eq.status == EquipmentStatus.RUNNING and random.random() < 0.01:
                eq.status = EquipmentStatus.BREAKDOWN
                eq.utilization = 0
                alert_type = random.choice(["equipment_failure", "thermal", "vibration", "overload"])
                team = random.choice(_TEAM_ASSIGNMENTS)
                alert = Alert(
                    id=f"alert_{uuid.uuid4().hex[:8]}",
                    mine_id=mine_id, mine_name=mine.name,
                    type=alert_type,
                    message=f"{eq.name} ({eq.type.value}) {alert_type.replace('_',' ')} at {mine.name}",
                    severity=AlertSeverity.CRITICAL,
                    timestamp=ts,
                    team_assigned=team,
                    equipment_id=eq.id,
                    location_tag=f"{mine.name.split()[0]}-Bay-{random.randint(1,12)}",
                )
                state.ALERTS.insert(0, alert)
                if len(state.ALERTS) > 200:
                    state.ALERTS = state.ALERTS[:200]
                ws_updates.append({"type": "alert", "data": alert.model_dump()})
                # Generate advisory for breakdown
                adv = generate_advisory(mine_id, mine.name, "Equipment Utilization",
                                        KPICategory.EQUIPMENT, eq)
                if adv:
                    state.ADVISORIES.insert(0, adv)
                    ws_updates.append({"type": "advisory", "data": adv.model_dump()})

            # Recovery from breakdown (5% chance per tick)
            elif eq.status == EquipmentStatus.BREAKDOWN and random.random() < 0.05:
                eq.status = EquipmentStatus.RUNNING
                eq.utilization = 60

            # Maintenance cycle
            elif eq.status == EquipmentStatus.MAINTENANCE and random.random() < 0.1:
                eq.status = EquipmentStatus.RUNNING
                eq.utilization = 90
                eq.hours_since_maintenance = 0

            # Random maintenance trigger
            elif eq.status == EquipmentStatus.RUNNING and eq.hours_since_maintenance > 500 and random.random() < 0.03:
                eq.status = EquipmentStatus.MAINTENANCE
                eq.utilization = 0

            # Update utilization for running equipment
            if eq.status == EquipmentStatus.RUNNING:
                eq.utilization = max(40, min(98, _jitter(eq.utilization, 0.03)))
                eq.hours_since_maintenance += 0.5
                eq.fuel_consumption = _jitter(eq.fuel_consumption, 0.02)

            eq.position["x"] += random.uniform(-0.5, 0.5)
            eq.position["z"] += random.uniform(-0.5, 0.5)

            # Generate sensor reading for every equipment every tick
            _add_sensor_reading(eq.id, mine_id, ts, eq.status.value, eq.utilization)

        running_count = sum(1 for e in mine_eq if e.status == EquipmentStatus.RUNNING)
        running_ratio = running_count / max(total_eq, 1)

        # ── KPI: Production Rate ───────────────────────
        base_prod = mine.capacity_mtpa * 1000000 / 8760  # TPH from MTPA
        prod = base_prod * running_ratio * day_factor * rain_factor * _jitter(1.0, 0.08)
        prod = max(100, round(prod, 1))
        mine.current_production_tph = prod
        prod_status = _status_for(prod, 500, 300)
        kpi_r = KPIReading(
            id=f"kpi_{mine_id}_prod_{_tick}", mine_id=mine_id,
            category=KPICategory.PRODUCTION, kpi_name="Production Rate",
            value=prod, unit="TPH", status=prod_status, timestamp=ts,
            thresholds={"green": 500, "amber": 300, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Production Rate"] = kpi_r
        _add_history(mine_id, "Production Rate", prod, ts)
        _maybe_add_anomaly(mine_id, "Production Rate", prod, prod_status, ts)

        if prod_status == KPIStatus.RED and random.random() < 0.3:
            adv = generate_advisory(mine_id, mine.name, "Production Rate",
                                    KPICategory.PRODUCTION)
            if adv:
                state.ADVISORIES.insert(0, adv)
                ws_updates.append({"type": "advisory", "data": adv.model_dump()})

        # ── KPI: Equipment Utilization ─────────────────
        avg_util = sum(e.utilization for e in mine_eq) / max(total_eq, 1)
        util_status = _status_for(avg_util, 85, 60)
        kpi_u = KPIReading(
            id=f"kpi_{mine_id}_util_{_tick}", mine_id=mine_id,
            category=KPICategory.EQUIPMENT, kpi_name="Equipment Utilization",
            value=round(avg_util, 1), unit="%", status=util_status, timestamp=ts,
            thresholds={"green": 85, "amber": 60, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Equipment Utilization"] = kpi_u
        _add_history(mine_id, "Equipment Utilization", avg_util, ts)
        _maybe_add_anomaly(mine_id, "Equipment Utilization", avg_util, util_status, ts)

        # ── KPI: Downtime ──────────────────────────────
        downtime = round((1 - running_ratio) * 100, 1)
        dt_status = _inv_status(downtime, 8, 15)
        kpi_d = KPIReading(
            id=f"kpi_{mine_id}_dt_{_tick}", mine_id=mine_id,
            category=KPICategory.EQUIPMENT, kpi_name="Downtime",
            value=downtime, unit="%", status=dt_status, timestamp=ts,
            thresholds={"green": 8, "amber": 15, "red": 100}
        )
        state.KPI_CURRENT[mine_id]["Downtime"] = kpi_d
        _add_history(mine_id, "Downtime", downtime, ts)
        _maybe_add_anomaly(mine_id, "Downtime", downtime, dt_status, ts)

        # ── KPI: Stripping Ratio ───────────────────────
        strip = _jitter(3.2 + (1 - running_ratio) * 2, 0.06)
        strip = max(1.5, round(strip, 2))
        sr_status = _inv_status(strip, 3.0, 5.0)
        kpi_s = KPIReading(
            id=f"kpi_{mine_id}_sr_{_tick}", mine_id=mine_id,
            category=KPICategory.PRODUCTION, kpi_name="Stripping Ratio",
            value=strip, unit="ratio", status=sr_status, timestamp=ts,
            thresholds={"green": 3.0, "amber": 5.0, "red": 10.0}
        )
        state.KPI_CURRENT[mine_id]["Stripping Ratio"] = kpi_s
        _add_history(mine_id, "Stripping Ratio", strip, ts)
        _maybe_add_anomaly(mine_id, "Stripping Ratio", strip, sr_status, ts)

        # ── KPI: Dispatch Efficiency ───────────────────
        log = state.LOGISTICS[mine_id]
        disp = _jitter(log.dispatch_efficiency * rain_factor, 0.04)
        disp = max(50, min(99, round(disp, 1)))
        log.dispatch_efficiency = disp
        log.stockpile_level_pct = max(10, min(95, _jitter(log.stockpile_level_pct, 0.03)))
        log.wagon_availability = max(50, min(98, _jitter(log.wagon_availability, 0.03)))
        log.trucks_active = max(3, min(log.trucks_total, log.trucks_active + random.choice([-1, 0, 0, 0, 1])))
        log.turnaround_time_hrs = max(2.0, min(8.0, _jitter(log.turnaround_time_hrs, 0.05)))
        de_status = _status_for(disp, 90, 75)
        kpi_de = KPIReading(
            id=f"kpi_{mine_id}_de_{_tick}", mine_id=mine_id,
            category=KPICategory.LOGISTICS, kpi_name="Dispatch Efficiency",
            value=disp, unit="%", status=de_status, timestamp=ts,
            thresholds={"green": 90, "amber": 75, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Dispatch Efficiency"] = kpi_de
        _add_history(mine_id, "Dispatch Efficiency", disp, ts)
        _maybe_add_anomaly(mine_id, "Dispatch Efficiency", disp, de_status, ts)

        # ── KPI: Wagon Availability ────────────────────
        wa_status = _status_for(log.wagon_availability, 85, 70)
        kpi_wa = KPIReading(
            id=f"kpi_{mine_id}_wa_{_tick}", mine_id=mine_id,
            category=KPICategory.LOGISTICS, kpi_name="Wagon Availability",
            value=round(log.wagon_availability, 1), unit="%", status=wa_status, timestamp=ts,
            thresholds={"green": 85, "amber": 70, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Wagon Availability"] = kpi_wa
        _add_history(mine_id, "Wagon Availability", log.wagon_availability, ts)
        _maybe_add_anomaly(mine_id, "Wagon Availability", log.wagon_availability, wa_status, ts)

        # ── KPI: Cost Per Tonne ────────────────────────
        fin = state.FINANCE_DATA[mine_id]
        fin.fuel_cost = _jitter(fin.fuel_cost, 0.03)
        fin.maintenance_cost = _jitter(fin.maintenance_cost, 0.04)
        cpt = (fin.fuel_cost + fin.maintenance_cost + fin.labor_cost) / max(prod * 0.5, 1)
        cpt = max(400, min(2000, round(cpt, 0)))
        fin.cost_per_tonne = cpt
        fin.revenue_daily = _jitter(fin.revenue_daily, 0.03)
        fin.ebitda_margin = max(5, min(40, _jitter(fin.ebitda_margin, 0.04)))
        cpt_status = _inv_status(cpt, 800, 1200)
        kpi_cpt = KPIReading(
            id=f"kpi_{mine_id}_cpt_{_tick}", mine_id=mine_id,
            category=KPICategory.FINANCE, kpi_name="Cost Per Tonne",
            value=cpt, unit="INR", status=cpt_status, timestamp=ts,
            thresholds={"green": 800, "amber": 1200, "red": 5000}
        )
        state.KPI_CURRENT[mine_id]["Cost Per Tonne"] = kpi_cpt
        _add_history(mine_id, "Cost Per Tonne", cpt, ts)
        _maybe_add_anomaly(mine_id, "Cost Per Tonne", cpt, cpt_status, ts)

        # ── KPI: CO₂ Emissions ─────────────────────────
        esg = state.ESG_DATA[mine_id]
        esg.co2_emissions_tpd = max(80, min(400, _jitter(esg.co2_emissions_tpd, 0.04)))
        esg.water_usage_kl = max(500, min(2500, _jitter(esg.water_usage_kl, 0.03)))
        esg.dust_level_ugm3 = max(40, min(200, _jitter(esg.dust_level_ugm3, 0.05)))
        esg.compliance_score = max(60, min(100, _jitter(esg.compliance_score, 0.02)))
        em_status = _inv_status(esg.co2_emissions_tpd, 150, 250)
        kpi_em = KPIReading(
            id=f"kpi_{mine_id}_em_{_tick}", mine_id=mine_id,
            category=KPICategory.ESG, kpi_name="CO₂ Emissions",
            value=round(esg.co2_emissions_tpd, 1), unit="TPD", status=em_status, timestamp=ts,
            thresholds={"green": 150, "amber": 250, "red": 500}
        )
        state.KPI_CURRENT[mine_id]["CO₂ Emissions"] = kpi_em
        _add_history(mine_id, "CO₂ Emissions", esg.co2_emissions_tpd, ts)
        _maybe_add_anomaly(mine_id, "CO₂ Emissions", esg.co2_emissions_tpd, em_status, ts)

        # ── KPI: Attendance ────────────────────────────
        hr = state.HR_DATA[mine_id]
        hr.attendance_pct = max(65, min(99, _jitter(hr.attendance_pct, 0.02)))
        hr.productivity_index = max(0.5, min(1.0, _jitter(hr.productivity_index, 0.03)))
        hr.overtime_hours = max(0, min(30, _jitter(hr.overtime_hours, 0.05)))
        hr.fatigue_risk = "high" if hr.overtime_hours > 20 else ("medium" if hr.overtime_hours > 12 else "low")
        att_status = _status_for(hr.attendance_pct, 92, 80)
        kpi_att = KPIReading(
            id=f"kpi_{mine_id}_att_{_tick}", mine_id=mine_id,
            category=KPICategory.HR, kpi_name="Workforce Attendance",
            value=round(hr.attendance_pct, 1), unit="%", status=att_status, timestamp=ts,
            thresholds={"green": 92, "amber": 80, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Workforce Attendance"] = kpi_att
        _add_history(mine_id, "Workforce Attendance", hr.attendance_pct, ts)
        _maybe_add_anomaly(mine_id, "Workforce Attendance", hr.attendance_pct, att_status, ts)

        # ── KPI: Safety Score ──────────────────────────
        ehs = state.EHS_DATA[mine_id]
        ehs.safety_score = max(50, min(100, _jitter(ehs.safety_score, 0.02)))
        ehs.near_misses = max(0, ehs.near_misses + random.choice([-1, 0, 0, 0, 0, 1]))
        ehs.incident_rate = max(0, min(5, _jitter(ehs.incident_rate, 0.05)))
        ehs.hazard_alerts = max(0, ehs.hazard_alerts + random.choice([-1, 0, 0, 0, 1]))
        ss_status = _status_for(ehs.safety_score, 85, 70)
        kpi_ss = KPIReading(
            id=f"kpi_{mine_id}_ss_{_tick}", mine_id=mine_id,
            category=KPICategory.EHS, kpi_name="Safety Score",
            value=round(ehs.safety_score, 1), unit="score", status=ss_status, timestamp=ts,
            thresholds={"green": 85, "amber": 70, "red": 0}
        )
        state.KPI_CURRENT[mine_id]["Safety Score"] = kpi_ss
        _add_history(mine_id, "Safety Score", ehs.safety_score, ts)
        _maybe_add_anomaly(mine_id, "Safety Score", ehs.safety_score, ss_status, ts)

        # ── Mine Status ────────────────────────────────
        statuses = [kpi_r.status, kpi_u.status, kpi_d.status, kpi_de.status, kpi_ss.status]
        if KPIStatus.RED in statuses:
            mine.status = MineStatus.CRITICAL
        elif KPIStatus.AMBER in statuses:
            mine.status = MineStatus.WARNING
        else:
            mine.status = MineStatus.NORMAL

        # ── Periodic alerts ────────────────────────────
        if _tick % 10 == 0 and random.random() < 0.3:
            msgs = [
                (f"Conveyor belt thermal anomaly at {mine.name}", AlertSeverity.WARNING, "thermal"),
                (f"Stockpile overflow risk at {mine.name}", AlertSeverity.WARNING, "operational"),
                (f"Dust levels elevated — SPM at {random.randint(120,200)} µg/m³ at {mine.name}", AlertSeverity.INFO, "environmental"),
                (f"Rail delay affecting dispatch at {mine.name}", AlertSeverity.CRITICAL, "logistics"),
                (f"Safety incident reported near Bay-{random.randint(1,8)} at {mine.name}", AlertSeverity.CRITICAL, "safety"),
                (f"Worker fatigue index elevated — shift {random.choice(['A','B','C'])} at {mine.name}", AlertSeverity.WARNING, "safety"),
                (f"Vibration anomaly on Excavator {random.randint(1,4)} at {mine.name}", AlertSeverity.WARNING, "vibration"),
                (f"Dump Truck {random.randint(1,8)} overload detected at {mine.name}", AlertSeverity.CRITICAL, "overload"),
            ]
            msg, sev, atype = random.choice(msgs)
            team = random.choice(_TEAM_ASSIGNMENTS)
            alert = Alert(
                id=f"alert_{uuid.uuid4().hex[:8]}", mine_id=mine_id, mine_name=mine.name,
                type=atype, message=msg, severity=sev, timestamp=ts,
                team_assigned=team,
                location_tag=f"{mine.name.split()[0]}-Zone-{random.choice(['A','B','C','D'])}",
            )
            state.ALERTS.insert(0, alert)
            ws_updates.append({"type": "alert", "data": alert.model_dump()})

        # Collect KPI update for WebSocket
        ws_updates.append({
            "type": "kpi_update",
            "mine_id": mine_id,
            "data": {k: v.model_dump() for k, v in state.KPI_CURRENT[mine_id].items()},
        })

    # Keep advisories bounded
    if len(state.ADVISORIES) > 100:
        state.ADVISORIES = state.ADVISORIES[:100]

    # Broadcast all updates
    if ws_updates:
        for update in ws_updates:
            await ws_manager.broadcast(update)


async def run_data_engine():
    """Continuously generate synthetic data."""
    # Initial seed — run a few warm-up ticks
    for _ in range(10):
        await _update_cycle()
        await asyncio.sleep(0.05)

    while True:
        await asyncio.sleep(settings.DATA_UPDATE_INTERVAL)
        try:
            await _update_cycle()
        except Exception as e:
            print(f"Data engine error: {e}")
