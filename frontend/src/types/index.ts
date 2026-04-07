export type Role = 'ceo' | 'ops_head' | 'mine_manager' | 'field_engineer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  assigned_mine_id: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: User, token: string) => void;
}

export type MineStatus = 'normal' | 'warning' | 'critical';
export type EquipmentStatus = 'running' | 'idle' | 'maintenance' | 'breakdown';
export type KPIStatusType = 'green' | 'amber' | 'red';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AdvisoryStatusType = 'active' | 'acknowledged' | 'resolved';

export type MineType = 'open_cast' | 'underground';

export interface Mine {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  region: string;
  mine_type: MineType;
  status: MineStatus;
  capacity_mtpa: number;
  current_production_tph: number;
  equipment_count: number;
  depth_m: number;
  seam_thickness_m: number;
  strip_ratio: number;
  bench_count: number;
}

export interface Equipment {
  id: string;
  mine_id: string;
  type: string;
  name: string;
  status: EquipmentStatus;
  utilization: number;
  last_maintenance: string;
  hours_since_maintenance: number;
  fuel_consumption: number;
  position: { x: number; y: number; z: number };
}

export interface KPIReading {
  id: string;
  mine_id: string;
  category: string;
  kpi_name: string;
  value: number;
  unit: string;
  status: KPIStatusType;
  timestamp: string;
  thresholds: Record<string, number>;
}

export interface KPIDefinition {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  green_threshold: string;
  amber_threshold: string;
  red_threshold: string;
  correlations: string[];
}

export interface Advisory {
  id: string;
  mine_id: string;
  mine_name: string;
  kpi_category: string;
  kpi_name: string;
  root_cause: string;
  impact: string;
  recommendation: string;
  confidence: number;
  severity: AlertSeverity;
  timestamp: string;
  status: AdvisoryStatusType;
  actions: { label: string; type: string }[];
  risk_score: number;
  time_to_impact: string;
  failure_probability: number;
  affected_entities: string[];
  affected_count: string;
  category_tag: string;
  priority_label: string;
  causal_chain: string[];
  trend_analysis: string;
  historical_context: string;
  preventive_actions: string[];
  corrective_actions: string[];
  overview_narrative: string;
  equipment_id: string;
  impact_details: Record<string, string>;
}

export interface Alert {
  id: string;
  mine_id: string;
  mine_name: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
  team_assigned: string | null;
  equipment_id: string | null;
  location_tag: string;
}

export interface WorkOrder {
  id: string;
  mine_id: string;
  equipment_id: string | null;
  type: string;
  description: string;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
}

export interface LogisticsData {
  mine_id: string;
  dispatch_efficiency: number;
  wagon_availability: number;
  turnaround_time_hrs: number;
  trucks_active: number;
  trucks_total: number;
  rail_status: string;
  stockpile_level_pct: number;
}

export interface HRData {
  mine_id: string;
  total_workforce: number;
  attendance_pct: number;
  productivity_index: number;
  safety_training_pct: number;
  overtime_hours: number;
  fatigue_risk: string;
}

export interface FinanceData {
  mine_id: string;
  cost_per_tonne: number;
  revenue_daily: number;
  ebitda_margin: number;
  fuel_cost: number;
  maintenance_cost: number;
  labor_cost: number;
}

export interface ESGData {
  mine_id: string;
  co2_emissions_tpd: number;
  water_usage_kl: number;
  land_reclaimed_ha: number;
  dust_level_ugm3: number;
  noise_level_db: number;
  compliance_score: number;
}

export interface EHSData {
  mine_id: string;
  incident_rate: number;
  near_misses: number;
  hazard_alerts: number;
  safety_score: number;
  last_incident_days: number;
  open_investigations: number;
}

export interface KPITimeSeries {
  kpi_name: string;
  mine_id: string;
  data: { value: number; timestamp: string }[];
  forecast: { value: number; timestamp: string }[];
  rolling_avg: number;
  anomalies: { timestamp: string; severity: string; description: string }[];
  ai_summary: string;
  definition: string;
  methodology: string;
  target_value: number;
  ytd_avg: number;
  industry_avg: number;
  delta_vs_yesterday: number;
  pct_of_target: number;
}

export interface EquipmentSensorData {
  timestamp: string;
  temperature: number;
  vibration: number;
  fuel_rate: number;
  pressure: number;
  load_pct: number;
  motor_current: number;
  oil_level: number;
  cycle_time: number;
}

export interface EquipmentMonitoringResponse {
  equipment: Equipment;
  sensors: EquipmentSensorData[];
  active_alerts: Alert[];
  advisories: Advisory[];
}
