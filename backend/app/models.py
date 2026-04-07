from __future__ import annotations
from pydantic import BaseModel
from enum import Enum
from datetime import datetime


# ── Enums ──────────────────────────────────────────────
class Role(str, Enum):
    CEO = "ceo"
    OPS_HEAD = "ops_head"
    MINE_MANAGER = "mine_manager"
    FIELD_ENGINEER = "field_engineer"


class EquipmentType(str, Enum):
    EXCAVATOR = "excavator"
    DUMP_TRUCK = "dump_truck"
    CONVEYOR = "conveyor"
    DRAGLINE = "dragline"
    DOZER = "dozer"
    DRILL = "drill"


class EquipmentStatus(str, Enum):
    RUNNING = "running"
    IDLE = "idle"
    MAINTENANCE = "maintenance"
    BREAKDOWN = "breakdown"


class MineType(str, Enum):
    OPEN_CAST = "open_cast"
    UNDERGROUND = "underground"


class MineStatus(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class KPICategory(str, Enum):
    PRODUCTION = "production"
    EQUIPMENT = "equipment"
    LOGISTICS = "logistics"
    HR = "hr"
    FINANCE = "finance"
    ESG = "esg"
    EHS = "ehs"


class KPIStatus(str, Enum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


class AdvisoryStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


# ── Auth ───────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    role: Role
    assigned_mine_id: str | None = None


# ── Mine ───────────────────────────────────────────────
class Mine(BaseModel):
    id: str
    name: str
    location: str
    lat: float
    lng: float
    region: str
    mine_type: MineType = MineType.OPEN_CAST
    status: MineStatus = MineStatus.NORMAL
    capacity_mtpa: float
    current_production_tph: float = 0
    equipment_count: int = 0
    depth_m: float = 0
    seam_thickness_m: float = 0
    strip_ratio: float = 0
    bench_count: int = 0


# ── Equipment ──────────────────────────────────────────
class Equipment(BaseModel):
    id: str
    mine_id: str
    type: EquipmentType
    name: str
    status: EquipmentStatus = EquipmentStatus.RUNNING
    utilization: float = 85.0
    last_maintenance: str = ""
    hours_since_maintenance: float = 0
    fuel_consumption: float = 0
    position: dict = {"x": 0, "y": 0, "z": 0}


# ── KPI ────────────────────────────────────────────────
class KPIReading(BaseModel):
    id: str
    mine_id: str
    category: KPICategory
    kpi_name: str
    value: float
    unit: str
    status: KPIStatus
    timestamp: str
    thresholds: dict = {}


class KPIDefinition(BaseModel):
    id: str
    name: str
    category: KPICategory
    unit: str
    description: str
    green_threshold: str
    amber_threshold: str
    red_threshold: str
    correlations: list[str] = []


class KPITimeSeries(BaseModel):
    kpi_name: str
    mine_id: str
    data: list[dict]
    forecast: list[dict] = []
    rolling_avg: float = 0.0
    anomalies: list[dict] = []
    ai_summary: str = ""
    definition: str = ""
    methodology: str = ""
    target_value: float = 0.0
    ytd_avg: float = 0.0
    industry_avg: float = 0.0
    delta_vs_yesterday: float = 0.0
    pct_of_target: float = 0.0


class EquipmentSensor(BaseModel):
    equipment_id: str
    mine_id: str
    timestamp: str
    temperature: float = 0.0
    vibration: float = 0.0
    fuel_rate: float = 0.0
    pressure: float = 0.0
    load_pct: float = 0.0
    motor_current: float = 0.0
    oil_level: float = 0.0
    cycle_time: float = 0.0


# ── Advisory ──────────────────────────────────────────
class Advisory(BaseModel):
    id: str
    mine_id: str
    mine_name: str = ""
    kpi_category: KPICategory
    kpi_name: str
    root_cause: str
    impact: str
    recommendation: str
    confidence: float
    severity: AlertSeverity
    timestamp: str
    status: AdvisoryStatus = AdvisoryStatus.ACTIVE
    actions: list[dict] = []
    # Rich advisory fields (matching reference UI)
    risk_score: int = 0
    time_to_impact: str = ""
    failure_probability: float = 0.0
    affected_entities: list[str] = []
    affected_count: str = ""
    category_tag: str = ""
    priority_label: str = ""
    causal_chain: list[str] = []
    trend_analysis: str = ""
    historical_context: str = ""
    preventive_actions: list[str] = []
    corrective_actions: list[str] = []
    overview_narrative: str = ""
    equipment_id: str = ""
    impact_details: dict = {}


# ── Alert ──────────────────────────────────────────────
class Alert(BaseModel):
    id: str
    mine_id: str
    mine_name: str = ""
    type: str
    message: str
    severity: AlertSeverity
    timestamp: str
    acknowledged: bool = False
    team_assigned: str | None = None
    equipment_id: str | None = None
    location_tag: str = ""


# ── Work Order ─────────────────────────────────────────
class WorkOrder(BaseModel):
    id: str
    mine_id: str
    equipment_id: str | None = None
    type: str
    description: str
    status: str = "open"
    priority: str = "medium"
    created_by: str = ""
    created_at: str = ""


# ── Subsystem Data ─────────────────────────────────────
class LogisticsData(BaseModel):
    mine_id: str
    dispatch_efficiency: float
    wagon_availability: float
    turnaround_time_hrs: float
    trucks_active: int
    trucks_total: int
    rail_status: str
    stockpile_level_pct: float


class HRData(BaseModel):
    mine_id: str
    total_workforce: int
    attendance_pct: float
    productivity_index: float
    safety_training_pct: float
    overtime_hours: float
    fatigue_risk: str


class FinanceData(BaseModel):
    mine_id: str
    cost_per_tonne: float
    revenue_daily: float
    ebitda_margin: float
    fuel_cost: float
    maintenance_cost: float
    labor_cost: float


class ESGData(BaseModel):
    mine_id: str
    co2_emissions_tpd: float
    water_usage_kl: float
    land_reclaimed_ha: float
    dust_level_ugm3: float
    noise_level_db: float
    compliance_score: float


class EHSData(BaseModel):
    mine_id: str
    incident_rate: float
    near_misses: int
    hazard_alerts: int
    safety_score: float
    last_incident_days: int
    open_investigations: int


# Rebuild forward ref
TokenResponse.model_rebuild()
