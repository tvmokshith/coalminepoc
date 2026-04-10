"""
Global in-memory state for the coal mining platform.
Initializes mines, equipment, KPIs, and subsystem data.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from app.models import (
    Mine, Equipment, KPIReading, Advisory, Alert, WorkOrder,
    EquipmentType, EquipmentStatus, MineStatus, KPICategory,
    KPIStatus, KPIDefinition, AlertSeverity,
    LogisticsData, HRData, FinanceData, ESGData, EHSData,
    EquipmentSensor,
)

# ──────────────────────────────────────────────────────
# MINES
# ──────────────────────────────────────────────────────
MINES: dict[str, Mine] = {}

_mine_seed = [
    {"id": "mine_gevra", "name": "Gevra Open Cast Mine", "location": "Korba, Chhattisgarh",
     "lat": 22.33, "lng": 82.58, "region": "Central", "capacity_mtpa": 50.0,
     "mine_type": "open_cast", "depth_m": 150, "seam_thickness_m": 18, "strip_ratio": 3.2, "bench_count": 8},
    {"id": "mine_kusmunda", "name": "Kusmunda Open Cast Mine", "location": "Korba, Chhattisgarh",
     "lat": 22.35, "lng": 82.68, "region": "Central", "capacity_mtpa": 45.0,
     "mine_type": "open_cast", "depth_m": 120, "seam_thickness_m": 14, "strip_ratio": 3.8, "bench_count": 6},
    {"id": "mine_jayant", "name": "Jayant Open Cast Mine", "location": "Singrauli, MP",
     "lat": 24.10, "lng": 82.65, "region": "Central", "capacity_mtpa": 25.0,
     "mine_type": "open_cast", "depth_m": 95, "seam_thickness_m": 10, "strip_ratio": 4.1, "bench_count": 5},
    {"id": "mine_nigahi", "name": "Nigahi Underground Mine", "location": "Singrauli, MP",
     "lat": 24.15, "lng": 82.70, "region": "Central", "capacity_mtpa": 20.0,
     "mine_type": "underground", "depth_m": 280, "seam_thickness_m": 4.5, "strip_ratio": 0, "bench_count": 0},
    {"id": "mine_rajmahal", "name": "Rajmahal Underground Mine", "location": "Godda, Jharkhand",
     "lat": 25.05, "lng": 87.40, "region": "Eastern", "capacity_mtpa": 18.0,
     "mine_type": "underground", "depth_m": 350, "seam_thickness_m": 3.8, "strip_ratio": 0, "bench_count": 0},
]

for m in _mine_seed:
    MINES[m["id"]] = Mine(**m)

# ──────────────────────────────────────────────────────
# EQUIPMENT
# ──────────────────────────────────────────────────────
EQUIPMENT: dict[str, Equipment] = {}

_eq_templates = [
    (EquipmentType.EXCAVATOR, 4, {"x": -30, "y": 0, "z": -20}),
    (EquipmentType.DUMP_TRUCK, 8, {"x": 0, "y": 0, "z": 0}),
    (EquipmentType.CONVEYOR, 3, {"x": 20, "y": 0, "z": 10}),
    (EquipmentType.DRAGLINE, 1, {"x": -40, "y": 0, "z": -30}),
    (EquipmentType.DOZER, 3, {"x": 10, "y": 0, "z": -10}),
    (EquipmentType.DRILL, 2, {"x": -20, "y": 0, "z": 20}),
]

for mine in MINES.values():
    for eq_type, count, base_pos in _eq_templates:
        for i in range(count):
            eq_id = f"{mine.id}_{eq_type.value}_{i+1}"
            EQUIPMENT[eq_id] = Equipment(
                id=eq_id,
                mine_id=mine.id,
                type=eq_type,
                name=f"{eq_type.value.replace('_',' ').title()} {i+1}",
                status=EquipmentStatus.RUNNING,
                utilization=80 + (i * 2) % 15,
                last_maintenance=(datetime.utcnow() - timedelta(days=i * 3 + 5)).isoformat(),
                hours_since_maintenance=(i * 3 + 5) * 8,
                fuel_consumption=120.0 + i * 10,
                position={"x": base_pos["x"] + i * 8, "y": base_pos["y"], "z": base_pos["z"] + i * 5},
            )
    mine.equipment_count = sum(1 for e in EQUIPMENT.values() if e.mine_id == mine.id)

# ──────────────────────────────────────────────────────
# KPI DEFINITIONS
# ──────────────────────────────────────────────────────
KPI_DEFINITIONS: list[KPIDefinition] = [
    KPIDefinition(id="kpi_production_rate", name="Production Rate", category=KPICategory.PRODUCTION,
                  unit="TPH", description="Tonnes of coal produced per hour",
                  green_threshold="> 500 TPH", amber_threshold="300-500 TPH", red_threshold="< 300 TPH",
                  correlations=["Equipment Utilization", "Downtime", "Stripping Ratio"]),
    KPIDefinition(id="kpi_equipment_util", name="Equipment Utilization", category=KPICategory.EQUIPMENT,
                  unit="%", description="Percentage of time equipment is in active use",
                  green_threshold="> 85%", amber_threshold="60-85%", red_threshold="< 60%",
                  correlations=["Production Rate", "Downtime", "Maintenance Cost"]),
    KPIDefinition(id="kpi_downtime", name="Downtime", category=KPICategory.EQUIPMENT,
                  unit="%", description="Percentage of scheduled time equipment is non-operational",
                  green_threshold="< 8%", amber_threshold="8-15%", red_threshold="> 15%",
                  correlations=["Production Rate", "Equipment Utilization", "Safety Score"]),
    KPIDefinition(id="kpi_stripping_ratio", name="Stripping Ratio", category=KPICategory.PRODUCTION,
                  unit="ratio", description="Overburden removed per tonne of coal",
                  green_threshold="< 3.0", amber_threshold="3.0-5.0", red_threshold="> 5.0",
                  correlations=["Cost Per Tonne", "Production Rate"]),
    KPIDefinition(id="kpi_dispatch_eff", name="Dispatch Efficiency", category=KPICategory.LOGISTICS,
                  unit="%", description="Percentage of planned dispatches completed",
                  green_threshold="> 90%", amber_threshold="75-90%", red_threshold="< 75%",
                  correlations=["Wagon Availability", "Stockpile Level"]),
    KPIDefinition(id="kpi_safety_score", name="Safety Score", category=KPICategory.EHS,
                  unit="score", description="Composite safety index (0-100)",
                  green_threshold="> 85", amber_threshold="70-85", red_threshold="< 70",
                  correlations=["Incident Rate", "Attendance", "Downtime"]),
    KPIDefinition(id="kpi_cost_per_tonne", name="Cost Per Tonne", category=KPICategory.FINANCE,
                  unit="INR", description="Total operating cost per tonne of coal",
                  green_threshold="< 800", amber_threshold="800-1200", red_threshold="> 1200",
                  correlations=["Production Rate", "Fuel Cost", "Maintenance Cost"]),
    KPIDefinition(id="kpi_emissions", name="CO₂ Emissions", category=KPICategory.ESG,
                  unit="TPD", description="Tonnes of CO₂ emitted per day",
                  green_threshold="< 150 TPD", amber_threshold="150-250 TPD", red_threshold="> 250 TPD",
                  correlations=["Production Rate", "Equipment Utilization", "Fuel Cost"]),
    KPIDefinition(id="kpi_attendance", name="Workforce Attendance", category=KPICategory.HR,
                  unit="%", description="Percentage of workforce reporting to duty",
                  green_threshold="> 92%", amber_threshold="80-92%", red_threshold="< 80%",
                  correlations=["Productivity", "Safety Score", "Overtime"]),
    KPIDefinition(id="kpi_wagon_avail", name="Wagon Availability", category=KPICategory.LOGISTICS,
                  unit="%", description="Railway wagon availability for dispatch",
                  green_threshold="> 85%", amber_threshold="70-85%", red_threshold="< 70%",
                  correlations=["Dispatch Efficiency", "Stockpile Level"]),
]

# ──────────────────────────────────────────────────────
# LIVE DATA STORES (updated by data engine)
# ──────────────────────────────────────────────────────
KPI_CURRENT: dict[str, dict[str, KPIReading]] = {}       # mine_id -> kpi_name -> reading
KPI_HISTORY: dict[str, dict[str, list[dict]]] = {}        # mine_id -> kpi_name -> [{value, timestamp}]
KPI_ANOMALIES: dict[str, dict[str, list[dict]]] = {}      # mine_id -> kpi_name -> [{timestamp, severity, description}]
EQUIPMENT_SENSORS: dict[str, list[dict]] = {}              # equipment_id -> [{timestamp, temp, vibration, ...}]
ALERTS: list[Alert] = []
ADVISORIES: list[Advisory] = []
WORK_ORDERS: list[WorkOrder] = []
ENGINE_TICK: int = 0

# Subsystem live data
LOGISTICS: dict[str, LogisticsData] = {}
HR_DATA: dict[str, HRData] = {}
FINANCE_DATA: dict[str, FinanceData] = {}
ESG_DATA: dict[str, ESGData] = {}
EHS_DATA: dict[str, EHSData] = {}

# Initialize subsystem data for each mine
for mine_id in MINES:
    KPI_CURRENT[mine_id] = {}
    KPI_HISTORY[mine_id] = {}
    KPI_ANOMALIES[mine_id] = {}
    LOGISTICS[mine_id] = LogisticsData(
        mine_id=mine_id, dispatch_efficiency=88.0, wagon_availability=82.0,
        turnaround_time_hrs=4.5, trucks_active=6, trucks_total=8,
        rail_status="operational", stockpile_level_pct=65.0
    )
    HR_DATA[mine_id] = HRData(
        mine_id=mine_id, total_workforce=450, attendance_pct=91.0,
        productivity_index=0.85, safety_training_pct=78.0,
        overtime_hours=12.0, fatigue_risk="low"
    )
    FINANCE_DATA[mine_id] = FinanceData(
        mine_id=mine_id, cost_per_tonne=850.0, revenue_daily=4200000.0,
        ebitda_margin=22.5, fuel_cost=180000.0,
        maintenance_cost=120000.0, labor_cost=350000.0
    )
    ESG_DATA[mine_id] = ESGData(
        mine_id=mine_id, co2_emissions_tpd=185.0, water_usage_kl=1200.0,
        land_reclaimed_ha=12.5, dust_level_ugm3=95.0,
        noise_level_db=72.0, compliance_score=88.0
    )
    EHS_DATA[mine_id] = EHSData(
        mine_id=mine_id, incident_rate=0.8, near_misses=3,
        hazard_alerts=2, safety_score=86.0,
        last_incident_days=14, open_investigations=1
    )

# Pre-index equipment by mine for O(1) lookup instead of full scan each call
_EQUIPMENT_INDEX: dict[str, list[Equipment]] = {mid: [] for mid in MINES}
for _eq in EQUIPMENT.values():
    _EQUIPMENT_INDEX[_eq.mine_id].append(_eq)


def get_mine_equipment(mine_id: str) -> list[Equipment]:
    return _EQUIPMENT_INDEX.get(mine_id, [])


def get_aggregated_kpis() -> dict[str, float]:
    """Return aggregated KPI values across all mines (for CEO view)."""
    total_production = 0
    total_downtime = 0
    total_dispatch = 0
    count = len(MINES)
    for mine_id in MINES:
        kpis = KPI_CURRENT.get(mine_id, {})
        if "Production Rate" in kpis:
            total_production += kpis["Production Rate"].value
        if "Downtime" in kpis:
            total_downtime += kpis["Downtime"].value
        if "Dispatch Efficiency" in kpis:
            total_dispatch += kpis["Dispatch Efficiency"].value
    return {
        "total_production_tph": round(total_production, 1),
        "avg_downtime_pct": round(total_downtime / max(count, 1), 1),
        "avg_dispatch_efficiency": round(total_dispatch / max(count, 1), 1),
        "active_mines": count,
        "total_equipment": len(EQUIPMENT),
        "active_alerts": sum(1 for a in ALERTS if not a.acknowledged),
        "active_advisories": sum(1 for a in ADVISORIES if a.status == "active"),
    }
