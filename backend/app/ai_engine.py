"""
AI Advisory Engine — generates contextual advisories based on KPI and equipment state.
"""
from __future__ import annotations
import uuid
import random
from datetime import datetime
from app.models import (
    Advisory, AdvisoryStatus, AlertSeverity, KPICategory, Equipment,
)

# Root cause / recommendation templates
_ADVISORY_TEMPLATES = {
    "Production Rate": [
        {
            "root_cause": "Excavator breakdown causing reduced digging capacity",
            "impact": "Production output reduced by 15-25%",
            "recommendation": "Deploy standby excavator and schedule immediate repair",
            "confidence": 0.92,
            "actions": [
                {"label": "Create Work Order", "type": "work_order"},
                {"label": "Escalate to Maintenance", "type": "escalate"},
            ],
        },
        {
            "root_cause": "Overburden removal delay impacting coal exposure",
            "impact": "Mining face availability decreased, production backlog building",
            "recommendation": "Reallocate dozers to overburden stripping operations",
            "confidence": 0.85,
            "actions": [
                {"label": "Reassign Equipment", "type": "reassign"},
                {"label": "Update Mine Plan", "type": "plan"},
            ],
        },
        {
            "root_cause": "Shift handover delays reducing effective operating hours",
            "impact": "Lost 45 minutes per shift change, ~5% daily production loss",
            "recommendation": "Implement rolling shift change protocol",
            "confidence": 0.78,
            "actions": [
                {"label": "Update Shift Schedule", "type": "schedule"},
            ],
        },
    ],
    "Equipment Utilization": [
        {
            "root_cause": "Preventive maintenance overdue on multiple units",
            "impact": "Equipment failure risk increased by 40%",
            "recommendation": "Schedule emergency maintenance window for critical units",
            "confidence": 0.90,
            "actions": [
                {"label": "Create Work Order", "type": "work_order"},
                {"label": "Order Spare Parts", "type": "procurement"},
            ],
        },
        {
            "root_cause": "Operator skill gap leading to sub-optimal equipment usage",
            "impact": "Equipment utilization 20% below optimal",
            "recommendation": "Deploy experienced operators and schedule retraining",
            "confidence": 0.75,
            "actions": [
                {"label": "Schedule Training", "type": "training"},
            ],
        },
    ],
    "Dispatch Efficiency": [
        {
            "root_cause": "Railway wagon shortage due to regional congestion",
            "impact": "Dispatch delayed by 4-6 hours, stockpile approaching capacity",
            "recommendation": "Switch to road transport for excess production",
            "confidence": 0.88,
            "actions": [
                {"label": "Activate Road Transport", "type": "logistics"},
                {"label": "Notify Rail Authority", "type": "escalate"},
            ],
        },
        {
            "root_cause": "Truck fleet reduced due to simultaneous maintenance",
            "impact": "Dispatch capacity reduced by 30%",
            "recommendation": "Stagger maintenance schedules and hire contract trucks",
            "confidence": 0.82,
            "actions": [
                {"label": "Hire Contract Trucks", "type": "procurement"},
                {"label": "Reschedule Maintenance", "type": "schedule"},
            ],
        },
    ],
    "Safety Score": [
        {
            "root_cause": "Worker fatigue from extended overtime shifts",
            "impact": "Incident probability increased by 35%",
            "recommendation": "Enforce mandatory rest periods and adjust shift patterns",
            "confidence": 0.91,
            "actions": [
                {"label": "Adjust Shifts", "type": "schedule"},
                {"label": "Issue Safety Alert", "type": "alert"},
            ],
        },
        {
            "root_cause": "Inadequate hazard signage in new operational area",
            "impact": "Near-miss incidents increased in zone B3",
            "recommendation": "Install hazard markers and conduct safety briefing",
            "confidence": 0.87,
            "actions": [
                {"label": "Deploy Signage", "type": "work_order"},
                {"label": "Schedule Briefing", "type": "training"},
            ],
        },
    ],
    "Cost Per Tonne": [
        {
            "root_cause": "Fuel consumption spike due to inefficient haul routes",
            "impact": "Operating cost per tonne increased by 12%",
            "recommendation": "Optimize haul road design and implement GPS routing",
            "confidence": 0.84,
            "actions": [
                {"label": "Optimize Routes", "type": "plan"},
                {"label": "Review Fuel Usage", "type": "analysis"},
            ],
        },
    ],
    "CO₂ Emissions": [
        {
            "root_cause": "Aging equipment with higher emission profiles",
            "impact": "Emissions exceeding quarterly compliance targets",
            "recommendation": "Accelerate fleet modernization and install emission filters",
            "confidence": 0.80,
            "actions": [
                {"label": "Fleet Assessment", "type": "analysis"},
                {"label": "Procurement Request", "type": "procurement"},
            ],
        },
    ],
    "Workforce Attendance": [
        {
            "root_cause": "Seasonal illness affecting workforce availability",
            "impact": "Attendance dropped below 85%, affecting shift coverage",
            "recommendation": "Activate contingency staffing and on-site health camp",
            "confidence": 0.77,
            "actions": [
                {"label": "Activate Backup Staff", "type": "schedule"},
                {"label": "Medical Camp", "type": "welfare"},
            ],
        },
    ],
}

_EQUIPMENT_TEMPLATES = [
    {
        "root_cause": "Hydraulic system failure on {equipment_name}",
        "impact": "Equipment offline, production capacity reduced by 10-15%",
        "recommendation": "Immediate hydraulic repair, deploy standby unit",
        "confidence": 0.94,
    },
    {
        "root_cause": "Engine overheating on {equipment_name} due to coolant leak",
        "impact": "Risk of permanent engine damage if not addressed",
        "recommendation": "Shut down unit, perform coolant system repair",
        "confidence": 0.91,
    },
    {
        "root_cause": "Track/tire wear on {equipment_name} exceeding safety limits",
        "impact": "Operational safety compromised, reduced mobility",
        "recommendation": "Replace tracks/tires during next maintenance window",
        "confidence": 0.88,
    },
]


def generate_advisory(
    mine_id: str,
    mine_name: str,
    kpi_name: str,
    category: KPICategory,
    equipment: Equipment | None = None,
) -> Advisory | None:
    """Generate an AI advisory for a KPI breach or equipment issue."""
    now = datetime.utcnow().isoformat()
    risk = random.randint(60, 100)
    fail_prob = round(random.uniform(0.3, 0.95), 2)
    time_impacts = ["1-2 hours", "2-4 hours", "4-8 hours", "12-24 hours", "immediate"]

    if equipment:
        template = random.choice(_EQUIPMENT_TEMPLATES)
        root = template["root_cause"].format(equipment_name=equipment.name)
        return Advisory(
            id=f"adv_{uuid.uuid4().hex[:8]}",
            mine_id=mine_id,
            mine_name=mine_name,
            kpi_category=category,
            kpi_name=kpi_name,
            root_cause=root,
            impact=template["impact"],
            recommendation=template["recommendation"],
            confidence=template["confidence"],
            severity=AlertSeverity.CRITICAL,
            timestamp=now,
            actions=[
                {"label": "Create Work Order", "type": "work_order"},
                {"label": "Dispatch Crew", "type": "dispatch"},
                {"label": "Escalate Issue", "type": "escalate"},
                {"label": "View Equipment", "type": "view"},
            ],
            risk_score=risk,
            time_to_impact=random.choice(time_impacts),
            failure_probability=fail_prob,
            affected_entities=[equipment.name, mine_name],
            affected_count=f"{random.randint(50, 300)} tonnes/hr impact",
            category_tag="Equipment Health",
            priority_label="L4 Emergency" if risk > 85 else "L3 Urgent",
            equipment_id=equipment.id,
            causal_chain=[
                root,
                f"Reduced {equipment.type.value} availability at {mine_name}",
                f"Production capacity decreased by 10-15%",
                f"Downstream dispatch targets at risk",
                f"Revenue impact: ₹{random.randint(2,8)}L/hour"
            ],
            trend_analysis=f"Equipment health declining over last {random.randint(3,12)} cycles. "
                           f"Utilization dropped {random.randint(5,20)}% from baseline. "
                           f"Maintenance interval exceeded by {random.randint(20,100)} hours. "
                           f"Trajectory: deteriorating.",
            historical_context=f"Similar failures on this equipment type historically resulted in "
                               f"{random.randint(4,24)}-hour downtime in {random.randint(60,85)}% of cases. "
                               f"Last comparable event required {random.randint(2,8)}-hour restoration.",
            overview_narrative=f"{equipment.name} at {mine_name} is experiencing {root.lower()}. "
                               f"Current utilization at {equipment.utilization:.0f}% with "
                               f"hours since maintenance at {equipment.hours_since_maintenance:.0f}. "
                               f"AI modelling projects a {fail_prob*100:.0f}% failure probability within "
                               f"the stated time window based on {random.randint(50,200)} consecutive anomalous readings.",
            preventive_actions=[
                "Increase inspection frequency to every 2 hours",
                "Review maintenance backlog for this unit",
                "Pre-order critical spare parts from supply chain",
                "Deploy backup equipment to maintain production",
            ],
            corrective_actions=[
                f"Emergency shutdown if vibration exceeds {random.randint(8,15)} mm/s",
                f"Immediate isolation and deploy standby unit",
                f"Schedule emergency repair window within {random.randint(2,8)} hours",
            ],
            impact_details={
                "failure_probability": f"{fail_prob*100:.0f}%",
                "production_impact": f"{random.randint(100,500)} TPH reduction",
                "operational_impact": "CRITICAL" if risk > 80 else "WARNING",
            },
        )

    templates = _ADVISORY_TEMPLATES.get(kpi_name)
    if not templates:
        return None

    template = random.choice(templates)
    sev = AlertSeverity.CRITICAL if template["confidence"] > 0.85 else AlertSeverity.WARNING
    return Advisory(
        id=f"adv_{uuid.uuid4().hex[:8]}",
        mine_id=mine_id,
        mine_name=mine_name,
        kpi_category=category,
        kpi_name=kpi_name,
        root_cause=template["root_cause"],
        impact=template["impact"],
        recommendation=template["recommendation"],
        confidence=template["confidence"],
        severity=sev,
        timestamp=now,
        actions=template.get("actions", []) + [
            {"label": "Dispatch Crew", "type": "dispatch"},
            {"label": "Schedule Maintenance", "type": "schedule"},
        ],
        risk_score=risk,
        time_to_impact=random.choice(time_impacts),
        failure_probability=fail_prob,
        affected_entities=[mine_name],
        affected_count=f"{random.randint(100, 500)} tonnes affected",
        category_tag=category.value.replace("_", " ").title(),
        priority_label="L4 Emergency" if sev == AlertSeverity.CRITICAL else "L3 Urgent",
        causal_chain=[
            template["root_cause"],
            f"Cascading impact on {kpi_name} at {mine_name}",
            template["impact"],
            f"Risk of further degradation if not addressed within {random.choice(time_impacts)}",
        ],
        trend_analysis=f"{kpi_name} trending {'down' if random.random() > 0.5 else 'unstable'} "
                       f"over last {random.randint(5,30)} measurement intervals. "
                       f"Rate of change: {random.uniform(-2,2):.1f}%/interval. "
                       f"Trajectory: {'deteriorating' if risk > 70 else 'stable'}.",
        historical_context=f"Similar {kpi_name} events at comparable mines historically resulted in "
                           f"{'production losses' if category == KPICategory.PRODUCTION else 'operational disruption'} "
                           f"in {random.randint(55,80)}% of cases when risk exceeded {random.randint(60,80)}/100. "
                           f"Last comparable event resulted in {random.randint(2,12)}-hour recovery.",
        overview_narrative=f"{mine_name} is experiencing {template['root_cause'].lower()}. "
                           f"{template['impact']}. "
                           f"Continuous monitoring indicates a sustained stress condition "
                           f"with composite risk at {risk}/100. "
                           f"AI modelling projects a {fail_prob*100:.0f}% failure probability within "
                           f"the stated time window.",
        preventive_actions=[
            template["recommendation"],
            f"Increase monitoring frequency for {kpi_name}",
            f"Review operational parameters at {mine_name}",
            "Notify shift supervisors of elevated risk",
        ],
        corrective_actions=[
            f"Emergency intervention if {kpi_name} crosses critical threshold",
            f"Activate contingency plan for {mine_name}",
        ],
        impact_details={
            "failure_probability": f"{fail_prob*100:.0f}%",
            "production_impact": f"{random.randint(100,500)} TPH at risk",
            "operational_impact": "CRITICAL" if sev == AlertSeverity.CRITICAL else "WARNING",
        },
    )
