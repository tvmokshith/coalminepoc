'use client';

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { minesApi, equipmentApi, kpiApi, alertsApi, advisoryApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Mine, Equipment, KPIReading, Alert, Advisory, KPIDefinition } from '@/types';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft, X, Info, Activity, AlertTriangle, Factory, Truck,
  Gauge, Timer, DollarSign, ShieldAlert, Layers, HardHat,
  Train, Zap, Maximize2, Minimize2, Droplets, Building2,
  Fuel, Weight, Power, Wrench, Package, Mountain, Wind,
  Flame, ThermometerSun, Eye, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from 'recharts';

// ================================================================
// MINE-SPECIFIC SCENE CONFIGURATIONS
// ================================================================
interface MineSceneConfig {
  terrainColor: string;
  terrainColor2: string;
  hillColor: string;
  treeColor: string;
  fogColor: string;
  sunPosition: [number, number, number];
  skyTurbidity: number;
  ambientIntensity: number;
  pitDepthScale: number;
  benchCount: number;
  rockColor: string;
  roadColor: string;
  vegetationDensity: number;
  weatherEffect: 'clear' | 'dusty' | 'hazy';
}

const MINE_CONFIGS: Record<string, MineSceneConfig> = {
  mine_gevra: {
    terrainColor: '#6b5a3e', terrainColor2: '#3a6b30', hillColor: '#3a6b3a',
    treeColor: '#1f5e1f', fogColor: '#4a6080', sunPosition: [150, 80, 120],
    skyTurbidity: 4, ambientIntensity: 0.7, pitDepthScale: 1.2, benchCount: 8,
    rockColor: '#8a7d6e', roadColor: '#7d6850', vegetationDensity: 60, weatherEffect: 'dusty',
  },
  mine_kusmunda: {
    terrainColor: '#7d5a2a', terrainColor2: '#4a7a35', hillColor: '#3a6840',
    treeColor: '#1d561d', fogColor: '#3d5878', sunPosition: [180, 90, 90],
    skyTurbidity: 3, ambientIntensity: 0.75, pitDepthScale: 1.0, benchCount: 6,
    rockColor: '#958870', roadColor: '#8d7a5a', vegetationDensity: 45, weatherEffect: 'clear',
  },
  mine_jayant: {
    terrainColor: '#6e5830', terrainColor2: '#4a8a3a', hillColor: '#4a8540',
    treeColor: '#207020', fogColor: '#455a70', sunPosition: [120, 70, 150],
    skyTurbidity: 4, ambientIntensity: 0.65, pitDepthScale: 0.8, benchCount: 5,
    rockColor: '#7d7565', roadColor: '#7a6d4e', vegetationDensity: 70, weatherEffect: 'hazy',
  },
  mine_nigahi: {
    terrainColor: '#5e4d30', terrainColor2: '#3c6838', hillColor: '#3c6540',
    treeColor: '#1e5c1e', fogColor: '#3a5570', sunPosition: [140, 85, 110],
    skyTurbidity: 3, ambientIntensity: 0.7, pitDepthScale: 0, benchCount: 0,
    rockColor: '#7a7065', roadColor: '#756a4f', vegetationDensity: 50, weatherEffect: 'clear',
  },
  mine_rajmahal: {
    terrainColor: '#655838', terrainColor2: '#3a7835', hillColor: '#408040',
    treeColor: '#1c581c', fogColor: '#405868', sunPosition: [110, 75, 140],
    skyTurbidity: 4, ambientIntensity: 0.65, pitDepthScale: 0, benchCount: 0,
    rockColor: '#8a7a58', roadColor: '#806a50', vegetationDensity: 55, weatherEffect: 'hazy',
  },
};

const getConfig = (mineId: string): MineSceneConfig => MINE_CONFIGS[mineId] || MINE_CONFIGS.mine_gevra;

// ================================================================
// INFRASTRUCTURE DATA - metrics shown on click
// ================================================================
interface InfraInfo {
  name: string;
  type: string;
  icon: string;
  status: string;
  metrics: { label: string; value: string; color?: string }[];
  description: string;
}

const OPEN_PIT_INFRA: Record<string, InfraInfo> = {
  open_pit: {
    name: 'Open Cast Pit', type: 'Mining', icon: 'mountain',
    status: 'Active Mining', description: 'Main mining pit with active dragline and shovel operations.',
    metrics: [
      { label: 'Active Benches', value: '4 / 6' },
      { label: 'Coal Seam', value: 'Seam III (12m)' },
      { label: 'OB Removal', value: '4,200 m\u00B3/hr' },
      { label: 'Coal Extraction', value: '1,850 t/hr' },
      { label: 'Strip Ratio', value: '3.6:1', color: 'amber' },
      { label: 'Ground Water Inflow', value: '80 m\u00B3/hr' },
    ],
  },
  processing_plant: {
    name: 'Coal Handling Plant', type: 'Processing', icon: 'factory',
    status: 'Operational', description: 'Primary CHP with crushers, screens, and washery.',
    metrics: [
      { label: 'Throughput', value: '2,400 t/hr', color: 'green' },
      { label: 'Crusher Load', value: '78%', color: 'green' },
      { label: 'Screen Efficiency', value: '91%', color: 'green' },
      { label: 'Washery Recovery', value: '86%', color: 'amber' },
      { label: 'Belt Speed', value: '4.2 m/s' },
      { label: 'Power Draw', value: '2.8 MW', color: 'amber' },
    ],
  },
  workshop: {
    name: 'Workshop & Maintenance Bay', type: 'Maintenance', icon: 'wrench',
    status: 'Active', description: 'Heavy equipment maintenance, repair facility with 6 service bays.',
    metrics: [
      { label: 'Bays Occupied', value: '4 / 6', color: 'amber' },
      { label: 'Active Repairs', value: '3' },
      { label: 'Avg Repair Time', value: '4.2 hrs' },
      { label: 'Parts Inventory', value: '94%', color: 'green' },
      { label: 'Pending Work Orders', value: '12', color: 'amber' },
      { label: 'Staff On Shift', value: '18' },
    ],
  },
  admin: {
    name: 'Administrative Office', type: 'Admin', icon: 'building',
    status: 'Active', description: 'Mine administration, control room, and communications center.',
    metrics: [
      { label: 'Staff Present', value: '45' },
      { label: 'Shift', value: 'Day Shift' },
      { label: 'CCTV Cameras', value: '24 online', color: 'green' },
      { label: 'Dispatch Console', value: 'Online', color: 'green' },
      { label: 'Emergency Systems', value: 'Armed', color: 'green' },
      { label: 'Radio Channels', value: '8 active' },
    ],
  },
  fuel_depot: {
    name: 'Fuel Storage Depot', type: 'Fuel', icon: 'fuel',
    status: 'Operational', description: 'Diesel storage with 2 bulk tanks and 4 dispensing pumps.',
    metrics: [
      { label: 'Tank 1 Level', value: '72%', color: 'green' },
      { label: 'Tank 2 Level', value: '45%', color: 'amber' },
      { label: 'Daily Consumption', value: '18,500 L' },
      { label: 'Active Pumps', value: '3 / 4' },
      { label: 'Last Delivery', value: '2 days ago' },
      { label: 'Next Delivery', value: 'Tomorrow' },
    ],
  },
  weigh_bridge: {
    name: 'Weigh Bridge Station', type: 'Weighing', icon: 'weight',
    status: 'Operational', description: 'Electronic weigh bridge for measurement.',
    metrics: [
      { label: 'Trucks Today', value: '142' },
      { label: 'Avg Load', value: '48.2 t' },
      { label: 'Total Dispatched', value: '6,839 t' },
      { label: 'Calibration', value: 'Valid', color: 'green' },
      { label: 'Queue', value: '3 trucks' },
      { label: 'Avg Wait', value: '4.5 min' },
    ],
  },
  coal_stockyard: {
    name: 'Coal Stockyard', type: 'Storage', icon: 'package',
    status: 'Active', description: 'Open-air coal storage with 4 stockpile zones.',
    metrics: [
      { label: 'Total Stock', value: '42,300 t' },
      { label: 'ROM Coal', value: '12,800 t' },
      { label: 'Washed', value: '8,200 t' },
      { label: 'Graded', value: '14,100 t' },
      { label: 'Reject', value: '7,200 t' },
      { label: 'Reclaim Rate', value: '800 t/hr' },
    ],
  },
  settling_pond: {
    name: 'Settling Pond', type: 'Environmental', icon: 'water',
    status: 'Normal', description: 'Mine water settling and treatment facility.',
    metrics: [
      { label: 'Water Level', value: '68%', color: 'green' },
      { label: 'pH Level', value: '7.2', color: 'green' },
      { label: 'TSS', value: '42 mg/L', color: 'green' },
      { label: 'Inflow', value: '120 m\u00B3/hr' },
      { label: 'Discharge', value: '95 m\u00B3/hr' },
      { label: 'Compliance', value: 'Within Limits', color: 'green' },
    ],
  },
  rail_siding: {
    name: 'Rail Loading Siding', type: 'Logistics', icon: 'train',
    status: 'Loading', description: 'Railway siding with rapid loading system.',
    metrics: [
      { label: 'Rakes Today', value: '3' },
      { label: 'Current Rake', value: '62% loaded', color: 'amber' },
      { label: 'Wagons Filled', value: '38 / 58' },
      { label: 'Loading Rate', value: '1,200 t/hr' },
      { label: 'Daily Target', value: '12,000 t' },
      { label: 'Achieved', value: '8,400 t', color: 'amber' },
    ],
  },
  power_substation: {
    name: 'Power Substation', type: 'Power', icon: 'power',
    status: 'Online', description: '33kV to 11kV step-down substation with 2 transformers.',
    metrics: [
      { label: 'Total Load', value: '12.4 MW', color: 'green' },
      { label: 'Transformer 1', value: '68%', color: 'green' },
      { label: 'Transformer 2', value: '52%', color: 'green' },
      { label: 'Power Factor', value: '0.92' },
      { label: 'Voltage', value: '11.2 kV', color: 'green' },
      { label: 'Backup DG', value: 'Standby', color: 'green' },
    ],
  },
};

const UNDERGROUND_INFRA: Record<string, InfraInfo> = {
  main_shaft: {
    name: 'Main Shaft & Winding Gear', type: 'Access', icon: 'mountain',
    status: 'Operational', description: 'Primary vertical shaft for man/material transport and coal hoisting.',
    metrics: [
      { label: 'Shaft Depth', value: '280m' },
      { label: 'Cage Speed', value: '8 m/s' },
      { label: 'Hoisting Capacity', value: '12 t/skip' },
      { label: 'Rope Condition', value: 'Good', color: 'green' },
      { label: 'Trips/Shift', value: '45' },
      { label: 'Men Down', value: '120' },
    ],
  },
  tunnel_main: {
    name: 'Main Haulage Roadway', type: 'Tunnel', icon: 'train',
    status: 'Active', description: 'Primary underground haulage with conveyor and rail network.',
    metrics: [
      { label: 'Length', value: '2,800m' },
      { label: 'Cross Section', value: '4.2m \u00D7 3.5m' },
      { label: 'Support Type', value: 'Steel Arch + Bolts' },
      { label: 'Conveyor Speed', value: '3.2 m/s' },
      { label: 'Roof Condition', value: 'Stable', color: 'green' },
      { label: 'Floor Heave', value: 'Minor', color: 'amber' },
    ],
  },
  longwall_panel: {
    name: 'Longwall Panel LW-03', type: 'Production', icon: 'factory',
    status: 'Active Cutting', description: 'Active longwall face with powered supports and shearer.',
    metrics: [
      { label: 'Face Length', value: '250m' },
      { label: 'Extraction', value: '1,200 t/shift' },
      { label: 'Shearer Speed', value: '12 m/min' },
      { label: 'Support Pressure', value: '320 bar', color: 'green' },
      { label: 'Advance Rate', value: '4.5 m/day' },
      { label: 'Recovery', value: '92%', color: 'green' },
    ],
  },
  ventilation: {
    name: 'Ventilation System', type: 'Safety', icon: 'wind',
    status: 'Running', description: 'Main fan and auxiliary ventilation network.',
    metrics: [
      { label: 'Main Fan', value: '180 m\u00B3/s', color: 'green' },
      { label: 'Air Velocity', value: '1.8 m/s', color: 'green' },
      { label: 'O\u2082 Level', value: '20.4%', color: 'green' },
      { label: 'CH\u2084 Level', value: '0.3%', color: 'green' },
      { label: 'CO Level', value: '8 ppm', color: 'green' },
      { label: 'Temperature', value: '28\u00B0C', color: 'amber' },
    ],
  },
  pump_station: {
    name: 'Pump Chamber', type: 'Dewatering', icon: 'water',
    status: 'Active', description: 'Underground dewatering system with 3 stage pumps.',
    metrics: [
      { label: 'Inflow Rate', value: '450 m\u00B3/hr', color: 'amber' },
      { label: 'Pump 1', value: '180 m\u00B3/hr', color: 'green' },
      { label: 'Pump 2', value: '160 m\u00B3/hr', color: 'green' },
      { label: 'Pump 3', value: 'Standby', color: 'green' },
      { label: 'Sump Level', value: '62%', color: 'amber' },
      { label: 'Discharge Head', value: '280m' },
    ],
  },
  gas_monitoring: {
    name: 'Gas Monitoring Station', type: 'Safety', icon: 'flame',
    status: 'Active', description: 'Continuous gas monitoring across all panels and roadways.',
    metrics: [
      { label: 'CH\u2084 (Methane)', value: '0.3%', color: 'green' },
      { label: 'CO', value: '8 ppm', color: 'green' },
      { label: 'CO\u2082', value: '0.4%', color: 'green' },
      { label: 'H\u2082S', value: '< 1 ppm', color: 'green' },
      { label: 'O\u2082', value: '20.4%', color: 'green' },
      { label: 'Sensors Online', value: '24 / 24', color: 'green' },
    ],
  },
  power_ug: {
    name: 'Underground Substation', type: 'Power', icon: 'power',
    status: 'Online', description: 'Underground 6.6kV/1.1kV distribution center.',
    metrics: [
      { label: 'Load', value: '4.2 MW', color: 'green' },
      { label: 'Transformer', value: '58% load', color: 'green' },
      { label: 'Earth Leakage', value: 'Normal', color: 'green' },
      { label: 'Cable Temp', value: '42\u00B0C', color: 'green' },
      { label: 'Protection', value: 'Active', color: 'green' },
      { label: 'Backup', value: 'Auto-switch Ready', color: 'green' },
    ],
  },
  refuge_chamber: {
    name: 'Refuge Chamber', type: 'Emergency', icon: 'building',
    status: 'Ready', description: 'Emergency refuge facility for 40 persons.',
    metrics: [
      { label: 'Capacity', value: '40 persons' },
      { label: 'O\u2082 Supply', value: '96 hrs', color: 'green' },
      { label: 'Food & Water', value: '72 hrs', color: 'green' },
      { label: 'Air Scrubber', value: 'Tested OK', color: 'green' },
      { label: 'Communication', value: 'Phone + Radio', color: 'green' },
      { label: 'Last Drill', value: '12 days ago' },
    ],
  },
  surface_plant: {
    name: 'Surface Coal Handling', type: 'Processing', icon: 'factory',
    status: 'Operational', description: 'Surface CHP receiving hoisted coal from shaft.',
    metrics: [
      { label: 'Throughput', value: '800 t/hr', color: 'green' },
      { label: 'Bunker Level', value: '55%', color: 'green' },
      { label: 'Screens', value: '2 active' },
      { label: 'Loading Rate', value: '600 t/hr' },
      { label: 'Stockpile', value: '8,200 t' },
      { label: 'Rail Dispatch', value: '3 rakes/day' },
    ],
  },
};

// ================================================================
// UNDERGROUND WARNINGS DATA
// ================================================================
interface MineWarning {
  id: string;
  type: 'water_seepage' | 'gas_accumulation' | 'roof_fall' | 'ventilation' | 'fire' | 'strata';
  severity: 'info' | 'warning' | 'critical';
  location: string;
  message: string;
  value?: string;
}

const UG_WARNINGS: MineWarning[] = [
  { id: 'w1', type: 'water_seepage', severity: 'warning', location: 'Panel LW-03 Gate Road', message: 'Water seepage detected - 45 L/min from roof fracture at 210m mark', value: '45 L/min' },
  { id: 'w2', type: 'gas_accumulation', severity: 'critical', location: 'Return Airway - Section 4B', message: 'Methane spike detected near goaf edge, level at 1.2% - approaching 1.5% threshold', value: '1.2% CH\u2084' },
  { id: 'w3', type: 'ventilation', severity: 'warning', location: 'Auxiliary Fan AF-03', message: 'Reduced airflow in development heading - fan bearing temperature elevated', value: '68\u00B0C bearing' },
  { id: 'w4', type: 'roof_fall', severity: 'info', location: 'Old Working Panel LW-01', message: 'Controlled roof convergence in sealed area - monitoring via extensometers', value: '12mm/month' },
  { id: 'w5', type: 'strata', severity: 'warning', location: 'Main Haulage Road 580m', message: 'Floor heave observed - 80mm over last 7 days, steel arch deformation detected', value: '80mm heave' },
  { id: 'w6', type: 'fire', severity: 'info', location: 'Belt Road 2', message: 'CO trending upward in sealed area behind stopping #14 - spontaneous combustion monitoring active', value: '25 ppm CO' },
];

const WARNING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  water_seepage: Droplets, gas_accumulation: Flame, roof_fall: Mountain,
  ventilation: Wind, fire: ThermometerSun, strata: Layers,
};

// ================================================================
// CLICKABLE 3D LABEL COMPONENT
// ================================================================
function ClickableLabel({ position, label, color, onClick }: {
  position: [number, number, number]; label: string; color: string; onClick: () => void;
}) {
  return (
    <Html position={position} center>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`text-[10px] font-bold px-3 py-2 rounded-lg whitespace-nowrap cursor-pointer transition-all duration-200 hover:scale-110 border shadow-xl`}
        style={{
          color, background: 'rgba(8,12,30,0.92)', borderColor: `${color}50`,
          boxShadow: `0 0 16px ${color}30, 0 4px 12px rgba(0,0,0,0.6)`,
        }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
          {label}
        </span>
      </div>
    </Html>
  );
}

// ================================================================
// OPEN PIT TERRAIN
// ================================================================
function OpenPitTerrain({ config }: { config: MineSceneConfig }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const alphaMap = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2;
    const innerR = size * 0.17;
    const outerR = size * 0.30;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(innerR / outerR, '#000000');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getY(i);
      const dist = Math.sqrt(x * x + z * z);
      let h = 0;
      if (dist > 105) h = (dist - 105) * 0.055 + Math.sin(x * 0.03) * 1.5 + Math.cos(z * 0.04) * 1.2;
      if (dist > 180) h += (dist - 180) * 0.06;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
  }, []);

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[900, 900, 128, 128]} />
        <meshStandardMaterial color={config.terrainColor} roughness={0.85} alphaMap={alphaMap} alphaTest={0.1} depthWrite={true} />
      </mesh>
      {/* Vegetation patches */}
      {Array.from({ length: config.vegetationDensity }, (_, i) => {
        const a = (i / config.vegetationDensity) * Math.PI * 2 + Math.random() * 0.3;
        const r = 185 + Math.random() * 110;
        return (<mesh key={`veg${i}`} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}>
          <circleGeometry args={[3 + Math.random() * 5, 6]} /><meshStandardMaterial color={config.terrainColor2} roughness={0.95} />
        </mesh>);
      })}
      {/* Surrounding hills with trees */}
      {[[-150,18,-140,50],[160,14,-120,40],[-130,20,130,55],[140,12,110,38],[0,16,-170,45],[-170,22,0,48],[170,10,30,35],[100,15,160,42],[-60,12,-170,38],[180,8,-60,30],[-180,14,60,36],[130,16,-160,44],[-90,10,170,32],[200,12,80,38]].map(([x,h,z,r],i) => (
        <group key={`hill${i}`}>
          <mesh position={[x,h/2-2,z]} castShadow><coneGeometry args={[r,h,12]} /><meshStandardMaterial color={config.hillColor} roughness={0.9} /></mesh>
          {/* Ridge detail on hills */}
          <mesh position={[x,h*0.6,z+r*0.3]} castShadow><coneGeometry args={[r*0.4,h*0.3,8]} /><meshStandardMaterial color={config.hillColor} roughness={0.85} /></mesh>
          {Array.from({ length: 9 }, (_, j) => {
            const ta = (j/9)*Math.PI*2; const tr = r*0.55;
            return (<group key={`t${i}_${j}`} position={[x+Math.cos(ta)*tr, h*0.3, z+Math.sin(ta)*tr]}>
              <mesh position={[0,2,0]} castShadow><cylinderGeometry args={[0.2,0.3,4,5]} /><meshStandardMaterial color="#3d2b1a" roughness={0.9} /></mesh>
              <mesh position={[0,5,0]} castShadow><coneGeometry args={[2.5,5,6]} /><meshStandardMaterial color={config.treeColor} roughness={0.85} /></mesh>
              <mesh position={[0,6.5,0]} castShadow><coneGeometry args={[1.8,3.5,6]} /><meshStandardMaterial color={config.treeColor} roughness={0.85} /></mesh>
            </group>);
          })}
          {/* Bushes at base of hills */}
          {Array.from({ length: 6 }, (_, j) => {
            const ba = (j/6)*Math.PI*2+0.3; const br = r*0.8;
            return (<mesh key={`bush${i}_${j}`} position={[x+Math.cos(ba)*br,0.5,z+Math.sin(ba)*br]} castShadow>
              <sphereGeometry args={[1.2+j*0.2,6,5]} /><meshStandardMaterial color={config.treeColor} roughness={0.9} />
            </mesh>);
          })}
        </group>
      ))}
      {/* Standalone tree clusters between hills */}
      {[[-60,0,100],[40,0,-130],[-110,0,-50],[120,0,80],[-30,0,150],[150,0,-80],[80,0,130],[-140,0,60],[170,0,-140],[-180,0,-100],[90,0,-150],[-50,0,-140]].map(([x,y,z],i) => (
        <group key={`stree${i}`} position={[x,y,z]}>
          <mesh position={[0,3,0]} castShadow><cylinderGeometry args={[0.25,0.35,6,5]} /><meshStandardMaterial color="#3d2b1a" roughness={0.9} /></mesh>
          <mesh position={[0,7,0]} castShadow><coneGeometry args={[3,6,6]} /><meshStandardMaterial color={config.treeColor} roughness={0.85} /></mesh>
          <mesh position={[0,9,0]} castShadow><coneGeometry args={[2,4,6]} /><meshStandardMaterial color={config.treeColor} roughness={0.85} /></mesh>
          <mesh position={[0,0.3,0]} castShadow><sphereGeometry args={[1,5,4]} /><meshStandardMaterial color={config.treeColor} roughness={0.9} /></mesh>
        </group>
      ))}
      {/* Rocks */}
      {[[90,2,60,4],[-100,3,-80,5],[70,2.5,-90,3.5],[-80,2,80,3],[110,1.5,-50,2.5],[-50,2,-100,4],[130,2.5,100,3],[-120,1.8,50,4.5],[40,3,-60,3],[160,2,60,2.5],[-30,1.5,120,3.5],[100,2.8,-130,4],[-150,2,-40,3],[-70,1.8,-130,4],[50,2.5,100,3.5],[-140,3,120,3],[180,1.5,-90,2.5],[20,2,170,3]].map(([x,h,z,s],i) => (
        <mesh key={`rock${i}`} position={[x,h/2,z]} rotation={[i*0.4,i*1.2,i*0.15]} castShadow>
          <dodecahedronGeometry args={[s,0]} /><meshStandardMaterial color={config.rockColor} roughness={0.95} />
        </mesh>
      ))}
      {/* Power line poles */}
      {Array.from({length:8},(_, i) => {
        const px = -180+i*50; const pz = -80;
        return (<group key={`pole${i}`} position={[px,0,pz]}>
          <mesh position={[0,8,0]}><cylinderGeometry args={[0.2,0.3,16,6]} /><meshStandardMaterial color="#5a534a" roughness={0.8} /></mesh>
          <mesh position={[0,15,0]}><boxGeometry args={[8,0.2,0.2]} /><meshStandardMaterial color="#5a534a" roughness={0.7} /></mesh>
          {[-3.5,3.5].map((wx,wi) => (<mesh key={wi} position={[wx,14.8,0]}><cylinderGeometry args={[0.15,0.15,1,4]} /><meshStandardMaterial color="#8a7a5e" roughness={0.6} /></mesh>))}
        </group>);
      })}
      {/* Perimeter fence posts */}
      {Array.from({length:24},(_, i) => {
        const angle = (i/24)*Math.PI*2;
        const fr = 235;
        return (<group key={`fence${i}`} position={[Math.cos(angle)*fr,0,Math.sin(angle)*fr]}>
          <mesh position={[0,1.5,0]}><cylinderGeometry args={[0.08,0.08,3,4]} /><meshStandardMaterial color="#7a7a70" roughness={0.7} metalness={0.3} /></mesh>
          <mesh position={[0,2.5,0]}><sphereGeometry args={[0.12,4,4]} /><meshStandardMaterial color="#b0b0a0" roughness={0.5} metalness={0.5} /></mesh>
        </group>);
      })}
      {/* Guard towers at cardinal positions */}
      {[[235,0,0],[0,0,235],[-235,0,0],[0,0,-235]].map(([x,y,z],i) => (
        <group key={`guard${i}`} position={[x,y,z]}>
          <mesh position={[0,5,0]}><boxGeometry args={[1.5,10,1.5]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
          <mesh position={[0,10.5,0]}><boxGeometry args={[3,2,3]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.4} /></mesh>
          <mesh position={[0,12,0]}><coneGeometry args={[2.5,1.5,4]} /><meshStandardMaterial color="#8b9280" roughness={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ================================================================
// UNDERGROUND TERRAIN - Surface view of an underground mine
// ================================================================
function UndergroundTerrain({ config }: { config: MineSceneConfig }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const alphaMap = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2;
    const innerR = size * 0.04;
    const outerR = size * 0.10;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(innerR / outerR, '#000000');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getY(i);
      const r = Math.sqrt(x * x + z * z);
      let h = Math.sin(x * 0.02) * 3 + Math.cos(z * 0.018) * 2.5 + Math.sin(x * 0.08) * 0.8;
      if (r > 120) h += (r - 120) * 0.05;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
  }, []);

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[500, 500, 100, 100]} />
        <meshStandardMaterial color={config.terrainColor} roughness={0.85} alphaMap={alphaMap} alphaTest={0.1} depthWrite={true} />
      </mesh>
      {/* Grass areas */}
      {Array.from({ length: config.vegetationDensity }, (_, i) => {
        const a = (i / config.vegetationDensity) * Math.PI * 2;
        const r = 40 + Math.random() * 120;
        return (<mesh key={`g${i}`} position={[Math.cos(a)*r, 0.05, Math.sin(a)*r]} rotation={[-Math.PI/2,0,Math.random()*Math.PI]}>
          <circleGeometry args={[2 + Math.random()*4, 6]} /><meshStandardMaterial color={config.terrainColor2} roughness={0.95} />
        </mesh>);
      })}
      {/* Hills & trees */}
      {[[-120,15,-100,40],[130,12,-80,35],[-100,18,110,45],[140,10,100,30],[0,14,-140,38],[-140,16,0,42],[160,12,50,32],[-160,10,-60,28],[80,14,-130,36],[-50,12,140,34]].map(([x,h,z,r],i) => (
        <group key={`hill${i}`}>
          <mesh position={[x,h/2-2,z]}><coneGeometry args={[r,h,12]} /><meshStandardMaterial color={config.hillColor} roughness={0.9} /></mesh>
          <mesh position={[x+r*0.2,h*0.5,z-r*0.25]}><coneGeometry args={[r*0.35,h*0.3,8]} /><meshStandardMaterial color={config.hillColor} roughness={0.85} /></mesh>
          {Array.from({length:8},(_, j) => {
            const ta = (j/8)*Math.PI*2; const tr = r*0.45;
            return (<group key={j} position={[x+Math.cos(ta)*tr,h*0.3,z+Math.sin(ta)*tr]}>
              <mesh position={[0,2,0]}><cylinderGeometry args={[0.2,0.3,4,5]} /><meshStandardMaterial color="#3d2b1a" /></mesh>
              <mesh position={[0,5,0]}><coneGeometry args={[2.5,5,6]} /><meshStandardMaterial color={config.treeColor} /></mesh>
              <mesh position={[0,7,0]}><coneGeometry args={[1.6,3,6]} /><meshStandardMaterial color={config.treeColor} /></mesh>
            </group>);
          })}
          {/* Bushes around hillbase */}
          {Array.from({length:5},(_, j) => {
            const ba = (j/5)*Math.PI*2+0.5; const br = r*0.75;
            return (<mesh key={`hb${j}`} position={[x+Math.cos(ba)*br,0.4,z+Math.sin(ba)*br]}>
              <sphereGeometry args={[1+j*0.15,5,4]} /><meshStandardMaterial color={config.treeColor} roughness={0.9} />
            </mesh>);
          })}
        </group>
      ))}
      {/* Standalone tree clusters */}
      {[[-40,0,80],[50,0,-90],[-80,0,-30],[90,0,60],[-20,0,120],[110,0,-50],[60,0,110],[-110,0,40],[130,0,-110],[-70,0,-100]].map(([x,y,z],i) => (
        <group key={`stree${i}`} position={[x,y,z]}>
          <mesh position={[0,2.5,0]}><cylinderGeometry args={[0.2,0.3,5,5]} /><meshStandardMaterial color="#3d2b1a" /></mesh>
          <mesh position={[0,6,0]}><coneGeometry args={[2.8,5.5,6]} /><meshStandardMaterial color={config.treeColor} /></mesh>
          <mesh position={[0,8.5,0]}><coneGeometry args={[1.8,3.5,6]} /><meshStandardMaterial color={config.treeColor} /></mesh>
          <mesh position={[0,0.3,0]}><sphereGeometry args={[0.8,5,4]} /><meshStandardMaterial color={config.treeColor} roughness={0.9} /></mesh>
        </group>
      ))}
      {/* Rocks/boulders */}
      {[[70,2,50,3],[-60,2.5,-70,4],[80,1.5,-60,2.5],[-90,2,70,3.5],[40,3,-80,3],[-30,2,90,4],[120,1.5,-40,2.5],[-50,2,-110,3],[100,2.5,90,3.5],[-120,1.8,80,2.8]].map(([x,h,z,s],i) => (
        <mesh key={`ugrock${i}`} position={[x,h/2,z]} rotation={[i*0.3,i*1.1,i*0.2]} castShadow>
          <dodecahedronGeometry args={[s,0]} /><meshStandardMaterial color={config.rockColor || '#7a7570'} roughness={0.95} />
        </mesh>
      ))}
      {/* Perimeter fencing around shaft area */}
      {Array.from({length:20},(_, i) => {
        const angle = (i/20)*Math.PI*2; const fr = 35;
        return (<group key={`ugfence${i}`} position={[Math.cos(angle)*fr,0,Math.sin(angle)*fr]}>
          <mesh position={[0,1.2,0]}><cylinderGeometry args={[0.06,0.06,2.4,4]} /><meshStandardMaterial color="#8a8a80" roughness={0.7} metalness={0.3} /></mesh>
        </group>);
      })}
      {/* Parking area */}
      <group position={[-30, 0, 35]}>
        <mesh position={[0,0.03,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[20,12]} /><meshStandardMaterial color="#4a4a50" roughness={0.85} /></mesh>
        {Array.from({length:4},(_, i) => (
          <mesh key={`car${i}`} position={[-6+i*4,0.5,0]}><boxGeometry args={[2.5,1,4]} /><meshStandardMaterial color={['#5b9cf6','#ef6464','#f5b830','#6db86d'][i]} roughness={0.4} metalness={0.5} /></mesh>
        ))}
      </group>
    </group>
  );
}

// ================================================================
// OPEN PIT - solid bowl shape with stepped benches
// ================================================================
function OpenPitMine({ mine, onClick }: { mine: Mine; onClick: () => void }) {
  const depthScale = getConfig(mine.id).pitDepthScale;
  const benchCount = mine.bench_count || 6;
  const seam = mine.seam_thickness_m || 12;
  // Wide pit, gentle ~24° slope angle
  const benchHeight = 4.0 * Math.max(0.7, depthScale);
  // gradient: top bench = light sandy, bottom = near-black coal
  const benchColors = ['#d8bc80', '#c0a060', '#a88040', '#8c6230', '#6e4c1e', '#50360e', '#342004', '#1c1002'];
  const baseRX = 115;  // wider X extent
  const baseRZ = 88;   // narrower Z extent (elliptical, like real pits)
  const SEGS = 72;     // high-res for smooth amoeba contour
  // Per-bench radius step — wide steps for gentle slope
  const stepX = 13.5;
  const stepZ = 10.5;
  // Flat shelf width on each bench road
  const shelfX = 4.5;
  const shelfZ = 3.5;

  // Deterministic seed from mine id
  const seed = useMemo(() =>
    (mine.id || 'a').split('').reduce((a, c) => a + c.charCodeAt(0), 0),
    [mine.id]
  );
  // Three low-frequency phases → smooth amoeba blob, never spiky
  const [phi1, phi2, phi3] = useMemo(() => [
    (seed % 100) * 0.063,
    (seed % 70)  * 0.091,
    (seed % 50)  * 0.126,
  ], [seed]);

  // Radial multiplier with only 3 harmonics — guaranteed smooth
  const amoeba = useCallback((angle: number) =>
    1
    + 0.13 * Math.sin(1 * angle + phi1)
    + 0.09 * Math.cos(2 * angle + phi2)
    + 0.04 * Math.sin(3 * angle + phi3),
    [phi1, phi2, phi3]
  );

  // Build bench geometries: flat shelf ring + inward-sloping face
  const benchGeometries = useMemo(() => {
    const geoms: {
      road: THREE.BufferGeometry;
      slope: THREE.BufferGeometry;
      y: number;
      color: string;
      oRX: number;
      oRZ: number;
    }[] = [];

    for (let bi = 0; bi < benchCount; bi++) {
      const y     = -bi * benchHeight;
      const color = benchColors[bi % benchColors.length];
      // Outer rim of this bench road
      const oRX = Math.max(6, baseRX - bi * stepX);
      const oRZ = Math.max(5, baseRZ - bi * stepZ);
      // Inner edge of the flat shelf (where the slope begins)
      const iRX = Math.max(4, oRX - shelfX);
      const iRZ = Math.max(3, oRZ - shelfZ);
      // Outer rim of the NEXT bench (bottom of the slope)
      const nRX = Math.max(4, oRX - stepX);
      const nRZ = Math.max(3, oRZ - stepZ);

      // ── Flat shelf (annular ring) ──────────────────────────────
      const roadV: number[] = [];
      const roadI: number[] = [];
      for (let s = 0; s < SEGS; s++) {
        const a1 = (s       / SEGS) * Math.PI * 2;
        const a2 = ((s + 1) / SEGS) * Math.PI * 2;
        const m1 = amoeba(a1), m2 = amoeba(a2);
        const o1x = Math.cos(a1) * oRX * m1, o1z = Math.sin(a1) * oRZ * m1;
        const o2x = Math.cos(a2) * oRX * m2, o2z = Math.sin(a2) * oRZ * m2;
        const i1x = Math.cos(a1) * iRX * m1, i1z = Math.sin(a1) * iRZ * m1;
        const i2x = Math.cos(a2) * iRX * m2, i2z = Math.sin(a2) * iRZ * m2;
        const b = roadV.length / 3;
        roadV.push(o1x, 0, o1z,  o2x, 0, o2z,  i1x, 0, i1z,  i2x, 0, i2z);
        roadI.push(b, b+1, b+2,  b+1, b+3, b+2);
      }
      const roadGeom = new THREE.BufferGeometry();
      roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadV, 3));
      roadGeom.setIndex(roadI);
      roadGeom.computeVertexNormals();

      // ── Sloped face (inner shelf edge → outer rim of next bench) ──
      // Goes inward AND downward → a proper open-pit slope, not a vertical wall
      const slopeV: number[] = [];
      const slopeI: number[] = [];
      for (let s = 0; s < SEGS; s++) {
        const a1 = (s       / SEGS) * Math.PI * 2;
        const a2 = ((s + 1) / SEGS) * Math.PI * 2;
        const m1 = amoeba(a1), m2 = amoeba(a2);
        // Top of slope = inner rim of shelf (same level as bench road)
        const t1x = Math.cos(a1) * iRX * m1, t1z = Math.sin(a1) * iRZ * m1;
        const t2x = Math.cos(a2) * iRX * m2, t2z = Math.sin(a2) * iRZ * m2;
        // Bottom of slope = outer rim of the next bench, one benchHeight below
        const b1x = Math.cos(a1) * nRX * m1, b1z = Math.sin(a1) * nRZ * m1;
        const b2x = Math.cos(a2) * nRX * m2, b2z = Math.sin(a2) * nRZ * m2;
        const b = slopeV.length / 3;
        slopeV.push(t1x, 0, t1z,  t2x, 0, t2z,  b1x, -benchHeight, b1z,  b2x, -benchHeight, b2z);
        slopeI.push(b, b+2, b+1,  b+1, b+2, b+3);
      }
      const slopeGeom = new THREE.BufferGeometry();
      slopeGeom.setAttribute('position', new THREE.Float32BufferAttribute(slopeV, 3));
      slopeGeom.setIndex(slopeI);
      slopeGeom.computeVertexNormals();

      geoms.push({ road: roadGeom, slope: slopeGeom, y, color, oRX, oRZ });
    }
    return geoms;
  }, [benchCount, benchHeight, stepX, stepZ, shelfX, shelfZ, baseRX, baseRZ, amoeba, benchColors]);

  return (
    <group>
      {benchGeometries.map((bg, i) => {
        const avgR = (bg.oRX + bg.oRZ) / 2;
        return (
          <group key={`bench${i}`}>
            {/* Flat bench shelf */}
            <mesh position={[0, bg.y, 0]} receiveShadow geometry={bg.road}>
              <meshStandardMaterial color={bg.color} roughness={0.86} side={THREE.DoubleSide} />
            </mesh>
            {/* Sloped face — connects shelf inner edge to next bench outer rim */}
            <mesh position={[0, bg.y, 0]} receiveShadow castShadow geometry={bg.slope}>
              <meshStandardMaterial color="#1e1608" roughness={0.92} side={THREE.DoubleSide} />
            </mesh>

            {/* Bench lighting poles (upper benches only) */}
            {i < 4 && Array.from({ length: 5 }, (_, li) => {
              const angle = (li / 5) * Math.PI * 2 + i * 0.5;
              return (
                <group key={`blight${li}`} position={[Math.cos(angle) * (bg.oRX - 3), bg.y, Math.sin(angle) * (bg.oRZ - 3)]}>
                  <mesh position={[0, 3.5, 0]}><cylinderGeometry args={[0.1, 0.14, 7, 4]} /><meshStandardMaterial color="#8a8075" roughness={0.6} metalness={0.4} /></mesh>
                  <mesh position={[0, 7.2, 0]}><sphereGeometry args={[0.4, 6, 6]} /><meshStandardMaterial color="#f5e6a0" emissive="#f5e6a0" emissiveIntensity={0.5} /></mesh>
                </group>
              );
            })}
            {/* Water puddle on lower benches */}
            {i >= benchCount - 2 && (
              <mesh position={[avgR * 0.28, bg.y + 0.03, -avgR * 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[5, 16]} />
                <meshStandardMaterial color="#2a7dac" roughness={0.08} metalness={0.6} transparent opacity={0.65} />
              </mesh>
            )}
            {/* Depth label */}
            <Html position={[bg.oRX + 10, bg.y + 2, 0]} center>
              <div className="text-[7px] text-slate-500 bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                Bench {i + 1} | {Math.round(Math.abs(bg.y) * (mine.depth_m / (benchCount * benchHeight)))}m
              </div>
            </Html>
          </group>
        );
      })}

      {/* ── Pit floor ─────────────────────────────────────────────── */}
      {(() => {
        const floorRX = Math.max(4, baseRX - benchCount * stepX);
        const floorRZ = Math.max(3, baseRZ - benchCount * stepZ);
        const floorR  = (floorRX + floorRZ) / 2;
        const floorY  = -benchCount * benchHeight;
        return (
          <group>
            <mesh position={[0, floorY + 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[floorR, 48]} />
              <meshStandardMaterial color="#141414" roughness={0.92} metalness={0.12} />
            </mesh>
            {/* Dewatering pump */}
            <group position={[floorR * 0.35, floorY + 0.5, -floorR * 0.25]}>
              <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.7, 0.7, 1.2, 8]} /><meshStandardMaterial color="#5b9cf6" roughness={0.4} metalness={0.5} /></mesh>
              <mesh position={[0, 1.8, 4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.22, 0.22, 8, 4]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
            </group>
            {/* Accumulated water pool */}
            <mesh position={[0, floorY + 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[floorR * 0.55, 32]} />
              <meshStandardMaterial color="#1a5a8a" roughness={0.04} metalness={0.65} transparent opacity={0.78} />
            </mesh>
          </group>
        );
      })()}

      {/* ── Pit label ─────────────────────────────────────────────── */}
      <Html position={[baseRX + 14, 5, 0]} center>
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-[10px] bg-black/90 px-3 py-2 rounded-lg cursor-pointer hover:bg-black/95 transition-colors border border-cyan-500/40 shadow-lg"
          style={{ boxShadow: '0 0 16px rgba(34,211,238,0.15)' }}
        >
          <div className="text-cyan-400 font-bold">Open Cast Pit</div>
          <div className="text-[8px] text-slate-400 mt-0.5">
            Depth: {mine.depth_m}m &middot; {benchCount} Benches &middot; Seam: {seam}m
          </div>
          <div className="text-[8px] text-slate-500">Strip Ratio: {mine.strip_ratio}:1</div>
        </div>
      </Html>
    </group>
  );
}

// ================================================================
// UNDERGROUND MINE - Cross-section tunnels visible
// ================================================================
function UndergroundMineSystem({ mine, onInfraClick }: { mine: Mine; onInfraClick: (id: string) => void }) {
  const tunnelColor = '#5a5550';
  const supportColor = '#b0a890';
  const coalColor = '#1a1a1a';
  const depth = mine.depth_m || 280;

  return (
    <group>
      {/* === MAIN SHAFT (vertical) === */}
      <group position={[0, 0, 0]}>
        {/* Shaft headframe */}
        <mesh position={[0, 16, 0]} castShadow><boxGeometry args={[8, 32, 8]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
        {/* Cross beams */}
        {[8, 16, 24].map((y, i) => (<mesh key={`xb${i}`} position={[0, y, 0]}><boxGeometry args={[12, 0.6, 12]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>))}
        {/* Diagonal braces */}
        {[0,1,2,3].map(i => {
          const angle = (i/4)*Math.PI*2;
          return (<mesh key={`brace${i}`} position={[Math.cos(angle)*5, 16, Math.sin(angle)*5]} rotation={[0.3*Math.cos(angle), 0, 0.3*Math.sin(angle)]}>
            <boxGeometry args={[0.3, 28, 0.3]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} />
          </mesh>);
        })}
        {/* Winding wheel */}
        <mesh position={[0, 30, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[5, 0.4, 8, 24]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Winding drum */}
        <mesh position={[8, 28, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[2, 2, 4, 12]} /><meshStandardMaterial color="#7b8593" roughness={0.4} metalness={0.6} /></mesh>
        {/* Winding rope */}
        <mesh position={[4, 28, 0]} rotation={[0, 0, 0.5]}><cylinderGeometry args={[0.05, 0.05, 10, 4]} /><meshStandardMaterial color="#c0c0b0" roughness={0.3} metalness={0.8} /></mesh>
        {/* Shaft collar (opening) */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[5.5, 5.5, 1.2, 16]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Safety platform around collar */}
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[5.5, 8, 16]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>
        {/* Safety railings */}
        {Array.from({length:12},(_, ri) => {
          const ra = (ri/12)*Math.PI*2; const rr = 7.5;
          return (<group key={`srail${ri}`}>
            <mesh position={[Math.cos(ra)*rr, 0.8, Math.sin(ra)*rr]}><cylinderGeometry args={[0.05,0.05,1.6,4]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.4} /></mesh>
          </group>);
        })}
        {/* Shaft tube going down */}
        <mesh position={[0, -20, 0]}>
          <cylinderGeometry args={[4.5, 4.5, 40, 16, 1, true]} /><meshStandardMaterial color="#3a3a3a" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        {/* Shaft lining rings */}
        {[-5,-10,-15,-20,-25,-30,-35].map((y,i) => (
          <mesh key={`sring${i}`} position={[0, y, 0]}><torusGeometry args={[4.5, 0.1, 4, 16]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>
        ))}
        {/* Skip/cage in shaft */}
        <mesh position={[0, -12, 0]}><boxGeometry args={[2.5, 3, 2.5]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
        {/* Shaft depth markers */}
        {[-5, -15, -25, -35].map((y, i) => (
          <Html key={`sd${i}`} position={[5, y, 0]} center>
            <div className="text-[7px] text-slate-600 bg-black/60 px-1 rounded pointer-events-none">{Math.round(Math.abs(y) * (depth / 40))}m</div>
          </Html>
        ))}
        <ClickableLabel position={[0, 35, 0]} label="Main Shaft" color="#22d3ee" onClick={() => onInfraClick('main_shaft')} />
      </group>

      {/* === VENTILATION SHAFT === */}
      <group position={[60, 0, -30]}>
        <mesh position={[0, 8, 0]} castShadow><cylinderGeometry args={[3.5, 3.5, 16, 12]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
        <mesh position={[0, 17, 0]}><cylinderGeometry args={[4, 3, 3, 12]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>
        {/* Fan housing */}
        <mesh position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.5, 0.6, 8, 16]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Fan blades */}
        {[0,1,2,3,4,5].map(i => (
          <mesh key={`fb${i}`} position={[Math.cos((i/6)*Math.PI*2)*2, 20, Math.sin((i/6)*Math.PI*2)*2]} rotation={[Math.PI/2,0,(i/6)*Math.PI*2]}>
            <boxGeometry args={[1.8, 0.05, 0.6]} /><meshStandardMaterial color="#c0c8b0" roughness={0.4} metalness={0.5} />
          </mesh>
        ))}
        {/* Vent duct extending from shaft */}
        <mesh position={[0, 16, -6]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[1.5, 1.5, 8, 8]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>
        {/* Safety cage around shaft top */}
        {Array.from({length:8},(_, i) => {
          const va = (i/8)*Math.PI*2; const vr = 5;
          return (<mesh key={`vcage${i}`} position={[Math.cos(va)*vr, 12, Math.sin(va)*vr]}><cylinderGeometry args={[0.06,0.06,8,4]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.4} /></mesh>);
        })}
        {/* Motor housing */}
        <mesh position={[5, 18, 0]} castShadow><boxGeometry args={[4, 3, 3]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
        <ClickableLabel position={[0, 24, 0]} label="Ventilation Shaft" color="#22c55e" onClick={() => onInfraClick('ventilation')} />
      </group>

      {/* === UNDERGROUND TUNNEL NETWORK (visible as cross-section) === */}
      <group position={[0, -35, 0]}>
        {/* Main haulage roadway (long horizontal) */}
        {(() => {
          const mainTunnel = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-80, 0, 0), new THREE.Vector3(-40, 0, 0),
            new THREE.Vector3(0, -2, 0), new THREE.Vector3(40, -3, 0),
            new THREE.Vector3(80, -3, 0), new THREE.Vector3(120, -4, 0),
          ]);
          return (
            <group>
              <mesh geometry={new THREE.TubeGeometry(mainTunnel, 60, 2.5, 8, false)}>
                <meshStandardMaterial color={tunnelColor} roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              {/* Tunnel supports along main haulage */}
              {mainTunnel.getPoints(20).map((p, i) => (
                <mesh key={`ms${i}`} position={[p.x, p.y, p.z]} rotation={[0, Math.atan2(i < 19 ? 1 : 0, 0), 0]}>
                  <torusGeometry args={[2.5, 0.15, 4, 12, Math.PI]} /><meshStandardMaterial color={supportColor} roughness={0.6} metalness={0.3} />
                </mesh>
              ))}
              {/* Conveyor belt along main haulage */}
              <mesh geometry={new THREE.TubeGeometry(mainTunnel, 60, 0.6, 4, false)}>
                <meshStandardMaterial color="#555" roughness={0.6} />
              </mesh>
              {/* Rail tracks along haulage */}
              {[-1.2, 1.2].map((zOff, ri) => {
                const railCurve = new THREE.CatmullRomCurve3(mainTunnel.getPoints(30).map(p => new THREE.Vector3(p.x, p.y - 1.8, p.z + zOff)));
                return (<mesh key={`rail${ri}`} geometry={new THREE.TubeGeometry(railCurve, 60, 0.06, 4, false)}>
                  <meshStandardMaterial color="#b0b8a0" roughness={0.2} metalness={0.8} />
                </mesh>);
              })}
              {/* Rail sleepers */}
              {mainTunnel.getPoints(40).map((p, i) => (
                <mesh key={`slpr${i}`} position={[p.x, p.y - 1.9, p.z]}><boxGeometry args={[0.3, 0.1, 3]} /><meshStandardMaterial color="#5a4a3a" roughness={0.9} /></mesh>
              ))}
              {/* Utility pipes along ceiling */}
              {[1.5, -1.5].map((zOff, pi) => {
                const pipeCurve = new THREE.CatmullRomCurve3(mainTunnel.getPoints(20).map(p => new THREE.Vector3(p.x, p.y + 2, p.z + zOff)));
                return (<mesh key={`pipe${pi}`} geometry={new THREE.TubeGeometry(pipeCurve, 40, 0.12, 4, false)}>
                  <meshStandardMaterial color={pi === 0 ? '#5b9cf6' : '#ef6464'} roughness={0.3} metalness={0.5} />
                </mesh>);
              })}
              {/* Cable trays */}
              {(() => {
                const cableCurve = new THREE.CatmullRomCurve3(mainTunnel.getPoints(20).map(p => new THREE.Vector3(p.x, p.y + 2.2, p.z)));
                return (<mesh geometry={new THREE.TubeGeometry(cableCurve, 40, 0.2, 4, false)}>
                  <meshStandardMaterial color="#3a3a3a" roughness={0.7} metalness={0.3} />
                </mesh>);
              })()}
              {/* Tunnel lighting */}
              {mainTunnel.getPoints(12).map((p, i) => (
                <mesh key={`tlight${i}`} position={[p.x, p.y + 2.3, p.z]}><sphereGeometry args={[0.2, 6, 6]} /><meshStandardMaterial color="#f5e6a0" emissive="#f5e6a0" emissiveIntensity={0.6} /></mesh>
              ))}
            </group>
          );
        })()}
        <ClickableLabel position={[20, 5, 0]} label="Main Haulage" color="#f59e0b" onClick={() => onInfraClick('tunnel_main')} />

        {/* Cross-cut tunnels (perpendicular) */}
        {[-40, 0, 40, 80].map((x, ci) => {
          const crossTunnel = new THREE.CatmullRomCurve3([
            new THREE.Vector3(x, -1 - ci * 0.5, -40), new THREE.Vector3(x, -1 - ci * 0.5, -15),
            new THREE.Vector3(x, -2 - ci * 0.5, 0), new THREE.Vector3(x, -1 - ci * 0.5, 15),
            new THREE.Vector3(x, -1 - ci * 0.5, 40),
          ]);
          return (
            <group key={`ct${ci}`}>
              <mesh geometry={new THREE.TubeGeometry(crossTunnel, 30, 2, 6, false)}>
                <meshStandardMaterial color={tunnelColor} roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              {crossTunnel.getPoints(10).map((p, i) => (
                <mesh key={`cs${ci}_${i}`} position={[p.x, p.y, p.z]} rotation={[0, Math.PI / 2, 0]}>
                  <torusGeometry args={[2, 0.12, 4, 12, Math.PI]} /><meshStandardMaterial color={supportColor} roughness={0.6} metalness={0.3} />
                </mesh>
              ))}
              {/* Ventilation door/stopping in cross-cut */}
              <mesh position={[x, -1.5 - ci * 0.5, 0]}><boxGeometry args={[0.15, 3.5, 3.5]} /><meshStandardMaterial color="#e08730" roughness={0.6} metalness={0.2} /></mesh>
              {/* Brattice cloth */}
              <mesh position={[x, -0.5 - ci * 0.5, -25]}><planeGeometry args={[3.5, 3]} /><meshStandardMaterial color="#f5b830" roughness={0.8} transparent opacity={0.7} side={THREE.DoubleSide} /></mesh>
              {/* Cross-cut lighting */}
              {[-20, -10, 0, 10, 20].map((z, li) => (
                <mesh key={`clight${ci}_${li}`} position={[x, -ci * 0.5 + 0.5, z]}><sphereGeometry args={[0.15, 5, 5]} /><meshStandardMaterial color="#f5e6a0" emissive="#f5e6a0" emissiveIntensity={0.5} /></mesh>
              ))}
            </group>
          );
        })}

        {/* Development headings (short dead-end tunnels) */}
        {[[100, -3, 25, Math.PI*0.3], [100, -3, -25, -Math.PI*0.3], [-60, -1, 35, Math.PI*0.6], [-60, -1, -35, -Math.PI*0.6]].map(([sx, sy, sz, angle], di) => {
          const devTunnel = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sx as number, sy as number, sz as number),
            new THREE.Vector3((sx as number)+Math.cos(angle as number)*15, (sy as number)-1, (sz as number)+Math.sin(angle as number)*15),
            new THREE.Vector3((sx as number)+Math.cos(angle as number)*30, (sy as number)-2, (sz as number)+Math.sin(angle as number)*30),
          ]);
          return (
            <group key={`dev${di}`}>
              <mesh geometry={new THREE.TubeGeometry(devTunnel, 20, 1.8, 6, false)}>
                <meshStandardMaterial color={tunnelColor} roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              {devTunnel.getPoints(6).map((p, i) => (
                <mesh key={`ds${di}_${i}`} position={[p.x, p.y, p.z]} rotation={[0, angle as number, 0]}>
                  <torusGeometry args={[1.8, 0.1, 4, 10, Math.PI]} /><meshStandardMaterial color={supportColor} roughness={0.6} metalness={0.3} />
                </mesh>
              ))}
            </group>
          );
        })}

        {/* Longwall panel (active face) */}
        <group position={[60, -3, 0]}>
          {/* Panel outline */}
          <mesh position={[0, 0, 0]}><boxGeometry args={[40, 1.5, 30]} /><meshStandardMaterial color={coalColor} roughness={0.9} metalness={0.1} /></mesh>
          {/* Powered supports (hydraulic shields) */}
          {Array.from({ length: 14 }, (_, i) => (
            <group key={`ps${i}`} position={[-17 + i * 2.5, 0, 0]}>
              <mesh position={[0, 1, 0]}><boxGeometry args={[0.8, 2, 28]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.6} /></mesh>
              {/* Hydraulic legs */}
              <mesh position={[0.3, 0.5, -10]}><cylinderGeometry args={[0.12, 0.12, 1.5, 6]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} /></mesh>
              <mesh position={[0.3, 0.5, 10]}><cylinderGeometry args={[0.12, 0.12, 1.5, 6]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} /></mesh>
            </group>
          ))}
          {/* Shearer (coal cutting machine) */}
          <group position={[5, 1.2, 14]}>
            <mesh position={[0, 0, 0]}><boxGeometry args={[6, 1.5, 2.5]} /><meshStandardMaterial color="#555" roughness={0.5} metalness={0.4} /></mesh>
            {/* Cutting drums */}
            <mesh position={[-4, 0.8, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[1.2, 1.2, 1.5, 12]} /><meshStandardMaterial color="#3a3a3a" roughness={0.7} metalness={0.5} /></mesh>
            <mesh position={[4, -0.5, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[1.2, 1.2, 1.5, 12]} /><meshStandardMaterial color="#3a3a3a" roughness={0.7} metalness={0.5} /></mesh>
            {/* Ranging arms */}
            <mesh position={[-3, 0.5, 0]} rotation={[0, 0, 0.3]}><boxGeometry args={[3, 0.4, 1]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
            <mesh position={[3, -0.2, 0]} rotation={[0, 0, -0.3]}><boxGeometry args={[3, 0.4, 1]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
          </group>
          {/* Armoured Face Conveyor (AFC) */}
          <mesh position={[0, -0.2, 14]}><boxGeometry args={[38, 0.4, 1.5]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
          {/* AFC chain flights */}
          {Array.from({length:16},(_, i) => (
            <mesh key={`afc${i}`} position={[-17+i*2.3, -0.1, 14]}><boxGeometry args={[0.15, 0.25, 1.3]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.6} /></mesh>
          ))}
          {/* Stage loader */}
          <mesh position={[20, -0.2, 16]}><boxGeometry args={[4, 0.8, 2]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
          {/* Beam stage loader (BSL) */}
          <mesh position={[22, 0, 20]} rotation={[0, Math.PI/4, 0]}><boxGeometry args={[6, 0.5, 1.5]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
          {/* Goaf (mined out area behind face) */}
          <mesh position={[0, -1, -20]}><boxGeometry args={[40, 0.5, 15]} /><meshStandardMaterial color="#2a2a2a" roughness={0.9} /></mesh>
          {/* Collapsed roof in goaf (rubble) */}
          {Array.from({length:12},(_, i) => (
            <mesh key={`goaf${i}`} position={[-15+i*3+Math.sin(i)*2, -0.3, -18+Math.cos(i)*5]}><dodecahedronGeometry args={[1+Math.sin(i)*0.5, 0]} /><meshStandardMaterial color="#3a3530" roughness={0.95} /></mesh>
          ))}
          <ClickableLabel position={[0, 5, 0]} label="Longwall Panel LW-03" color="#ef4444" onClick={() => onInfraClick('longwall_panel')} />
        </group>

        {/* Pump chamber */}
        <group position={[-60, -5, -20]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[12, 6, 10]} /><meshStandardMaterial color="#4e6580" roughness={0.6} metalness={0.3} /></mesh>
          {/* Pumps */}
          {[-3, 0, 3].map((z, i) => (
            <group key={`pump${i}`}>
              <mesh position={[0, -1, z]}><cylinderGeometry args={[1, 1, 2.5, 8]} /><meshStandardMaterial color="#5b9cf6" roughness={0.4} metalness={0.5} /></mesh>
              {/* Motor on pump */}
              <mesh position={[2, -0.5, z]}><boxGeometry args={[1.5, 1, 1.5]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
              {/* Intake pipe */}
              <mesh position={[-2, -2, z]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.25, 0.25, 3, 6]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
            </group>
          ))}
          {/* Discharge pipe */}
          <mesh position={[0, 10, -25]} rotation={[0.1, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 50, 6]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} />
          </mesh>
          {/* Sump (water collection) */}
          <mesh position={[0, -3.5, 0]}><boxGeometry args={[14, 1, 12]} /><meshStandardMaterial color="#2a7dac" roughness={0.1} metalness={0.3} transparent opacity={0.5} /></mesh>
          {/* Pipe manifold */}
          <mesh position={[0, 2, -5]}><boxGeometry args={[10, 0.3, 0.3]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
          {/* Valve handles */}
          {[-3, 0, 3].map((z, i) => (
            <mesh key={`valve${i}`} position={[0, 1.5, z]} rotation={[Math.PI/2, 0, 0]}><torusGeometry args={[0.3, 0.05, 4, 8]} /><meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.5} /></mesh>
          ))}
          <ClickableLabel position={[0, 5, 0]} label="Pump Chamber" color="#3b82f6" onClick={() => onInfraClick('pump_station')} />
        </group>

        {/* Gas monitoring station */}
        <group position={[20, -2, 30]}>
          <mesh><boxGeometry args={[4, 4, 4]} /><meshStandardMaterial color="#4e6580" roughness={0.6} metalness={0.3} /></mesh>
          {/* Sensor modules */}
          {[-1, 0, 1].map(x => (
            <mesh key={`sens${x}`} position={[x, 2, 0]}><sphereGeometry args={[0.3, 8, 8]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} /></mesh>
          ))}
          {/* Instrument panel */}
          <mesh position={[0, 1, 2.1]}><planeGeometry args={[3, 2.5]} /><meshStandardMaterial color="#1a2a3a" roughness={0.3} metalness={0.2} /></mesh>
          {/* Status LEDs */}
          {[-0.8,0,0.8].map((x,i) => (
            <mesh key={`led${i}`} position={[x, 1.8, 2.15]}><sphereGeometry args={[0.1, 6, 6]} /><meshStandardMaterial color={['#22c55e','#f5b830','#22c55e'][i]} emissive={['#22c55e','#f5b830','#22c55e'][i]} emissiveIntensity={0.8} /></mesh>
          ))}
          {/* Cable conduit to ceiling */}
          <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.1, 0.1, 4, 4]} /><meshStandardMaterial color="#3a3a3a" roughness={0.7} /></mesh>
          <ClickableLabel position={[0, 5, 0]} label="Gas Monitoring" color="#22c55e" onClick={() => onInfraClick('gas_monitoring')} />
        </group>

        {/* Refuge chamber */}
        <group position={[-20, -1, -30]}>
          <mesh castShadow><boxGeometry args={[10, 4, 6]} /><meshStandardMaterial color="#e08730" roughness={0.5} metalness={0.3} /></mesh>
          {/* Reinforced door */}
          <mesh position={[5.1, 0, 0]}><planeGeometry args={[2, 2.5]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} /></mesh>
          {/* Door handle */}
          <mesh position={[5.15, 0.3, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.05, 0.05, 0.8, 4]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} /></mesh>
          {/* Air supply cylinders */}
          {[-2, -1, 0, 1, 2].map((z, i) => (
            <mesh key={`air${i}`} position={[-4, -0.5, z]}><cylinderGeometry args={[0.25, 0.25, 3, 6]} /><meshStandardMaterial color="#22c55e" roughness={0.4} metalness={0.5} /></mesh>
          ))}
          {/* Bench seating inside (visible through walls conceptually) */}
          <mesh position={[0, -1.5, 0]}><boxGeometry args={[8, 0.3, 4]} /><meshStandardMaterial color="#555" roughness={0.7} /></mesh>
          {/* Emergency beacon */}
          <mesh position={[0, 2.5, 0]}><sphereGeometry args={[0.3, 6, 6]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} /></mesh>
          <ClickableLabel position={[0, 5, 0]} label="Refuge Chamber" color="#f97316" onClick={() => onInfraClick('refuge_chamber')} />
        </group>

        {/* Power substation underground */}
        <group position={[-50, -2, 20]}>
          <mesh><boxGeometry args={[8, 5, 6]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} /></mesh>
          <mesh position={[5, 0, 0]}><boxGeometry args={[3, 4, 4]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
          {/* Transformer units */}
          {[-2, 2].map((z, i) => (
            <mesh key={`xfmr${i}`} position={[0, -1, z]}><cylinderGeometry args={[0.8, 0.8, 3, 8]} /><meshStandardMaterial color="#4e6580" roughness={0.5} metalness={0.5} /></mesh>
          ))}
          {/* Switchgear panels */}
          <mesh position={[-4, 0, 0]}><boxGeometry args={[0.3, 4, 5.5]} /><meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.3} /></mesh>
          {/* Status lights */}
          {[-1, 0, 1].map((z, i) => (
            <mesh key={`xlight${i}`} position={[-4.2, 1, z]}><sphereGeometry args={[0.12, 5, 5]} /><meshStandardMaterial color={['#22c55e','#22c55e','#f5b830'][i]} emissive={['#22c55e','#22c55e','#f5b830'][i]} emissiveIntensity={0.6} /></mesh>
          ))}
          {/* Cable trays outgoing */}
          {[-3, 3].map((z, i) => (
            <mesh key={`xcable${i}`} position={[0, 3, z]}><boxGeometry args={[12, 0.1, 0.3]} /><meshStandardMaterial color="#3a3a3a" roughness={0.7} /></mesh>
          ))}
          <ClickableLabel position={[0, 5, 0]} label="UG Substation" color="#eab308" onClick={() => onInfraClick('power_ug')} />
        </group>

        {/* Explosive magazine (underground) */}
        <group position={[-80, -3, 10]}>
          <mesh><boxGeometry args={[6, 4, 5]} /><meshStandardMaterial color="#8b4040" roughness={0.6} metalness={0.3} /></mesh>
          <mesh position={[3.1, 0, 0]}><planeGeometry args={[1.8, 2.5]} /><meshStandardMaterial color="#ef4444" roughness={0.6} /></mesh>
          <mesh position={[0, 2.5, 0]}><boxGeometry args={[6.5, 0.3, 5.5]} /><meshStandardMaterial color="#8b4040" roughness={0.6} /></mesh>
          <ClickableLabel position={[0, 4, 0]} label="Explosive Magazine" color="#ef4444" onClick={() => onInfraClick('explosive_mag')} />
        </group>

        {/* Belt loading point */}
        <group position={[-10, -2, 0]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[5, 2, 4]} /><meshStandardMaterial color="#555" roughness={0.6} metalness={0.4} /></mesh>
          <mesh position={[0, 1.5, 0]} rotation={[0, 0, 0.1]}><boxGeometry args={[8, 0.4, 2.5]} /><meshStandardMaterial color="#3a3a3a" roughness={0.6} /></mesh>
          {/* Chute */}
          <mesh position={[-3, 2, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[3, 0.3, 2]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.4} /></mesh>
        </group>
      </group>

      {/* === WARNING INDICATORS (floating in scene) === */}
      {/* Water seepage dripping effect */}
      <WaterSeepageEffect position={[-10, -30, 5]} />
      {/* Methane cloud near goaf */}
      <GasCloudEffect position={[60, -33, -20]} />

      {/* === SURFACE INFRASTRUCTURE === */}
      {/* Surface CHP */}
      <group position={[80, 0, 40]}>
        <mesh position={[0, 6, 0]} castShadow><boxGeometry args={[22, 12, 16]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} /></mesh>
        <mesh position={[-10, 4, 0]} castShadow><boxGeometry args={[6, 8, 7]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
        {[-3, 3, 9].map((z, i) => (<mesh key={`silo${i}`} position={[12, 6, z]}><cylinderGeometry args={[3.5, 3.5, 12, 12]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>))}
        {[-3, 3, 9].map((z, i) => (<mesh key={`silotop${i}`} position={[12, 12.5, z]}><coneGeometry args={[3.8, 2.5, 12]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.5} /></mesh>))}
        {/* Screens/crusher housing */}
        <mesh position={[-5, 10, 8]} castShadow><boxGeometry args={[8, 4, 5]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.4} /></mesh>
        {/* Transfer conveyor */}
        <mesh position={[-15, 8, 0]} rotation={[0, 0, 0.15]}><boxGeometry args={[18, 0.3, 2]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
        {[-20,-16,-12,-8].map((x, i) => (<mesh key={`cleg${i}`} position={[x, 4, 0]}><cylinderGeometry args={[0.2, 0.2, 8, 4]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>))}
        {/* Chimney/stack */}
        <mesh position={[18, 12, 0]}><cylinderGeometry args={[1.2, 1.5, 24, 8]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>
        {/* Control room on side */}
        <mesh position={[-14, 3, 8]} castShadow><boxGeometry args={[4, 6, 5]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
        <mesh position={[-14, 3, 10.6]}><planeGeometry args={[3, 3]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.4} /></mesh>
        <ClickableLabel position={[0, 14, 0]} label="Surface Coal Handling" color="#f59e0b" onClick={() => onInfraClick('surface_plant')} />
      </group>

      {/* Admin building */}
      <group position={[-60, 0, 50]}>
        <mesh position={[0, 4, 0]} castShadow><boxGeometry args={[16, 8, 12]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
        {[-4, -1, 2, 5].map((x, i) => (<mesh key={`w${i}`} position={[x, 4, 6.1]}><planeGeometry args={[1.8, 1.8]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.6} /></mesh>))}
        {[-4, -1, 2, 5].map((x, i) => (<mesh key={`w2${i}`} position={[x, 6, 6.1]}><planeGeometry args={[1.8, 1.8]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.4} /></mesh>))}
        <mesh position={[0, 8.5, 0]}><boxGeometry args={[17, 1.2, 13]} /><meshStandardMaterial color="#8b9598" roughness={0.4} metalness={0.5} /></mesh>
        {/* Entrance portico */}
        <mesh position={[0, 3, 6.5]}><boxGeometry args={[4, 6, 2]} /><meshStandardMaterial color="#8b9598" roughness={0.5} metalness={0.4} /></mesh>
        <mesh position={[0, 6.5, 6.5]}><boxGeometry args={[5, 0.5, 3]} /><meshStandardMaterial color="#8b9598" roughness={0.4} metalness={0.5} /></mesh>
        {/* Flag pole */}
        <mesh position={[9, 5, 7]}><cylinderGeometry args={[0.08, 0.1, 10, 4]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
        <mesh position={[9.5, 9, 7]}><planeGeometry args={[1.5, 1]} /><meshStandardMaterial color="#ef6464" roughness={0.8} side={THREE.DoubleSide} /></mesh>
        {/* AC units on roof */}
        {[-4, 4].map((x, i) => (<mesh key={`ac${i}`} position={[x, 9.5, 0]}><boxGeometry args={[2, 1.5, 2]} /><meshStandardMaterial color="#8b9598" roughness={0.5} metalness={0.5} /></mesh>))}
      </group>

      {/* Workshop */}
      <group position={[-40, 0, -50]}>
        <mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[20, 9, 14]} /><meshStandardMaterial color="#74706c" roughness={0.7} metalness={0.3} /></mesh>
        <mesh position={[0, 9.5, 0]}><boxGeometry args={[22, 1.5, 16]} /><meshStandardMaterial color="#87837e" roughness={0.6} metalness={0.4} /></mesh>
        {/* Workshop doors (rolling shutters) */}
        {[-6, 0, 6].map((x, i) => (<mesh key={`wdoor${i}`} position={[x, 3, 7.1]}><planeGeometry args={[4, 6]} /><meshStandardMaterial color="#4a4a50" roughness={0.7} metalness={0.3} /></mesh>))}
        {/* Overhead crane rail */}
        <mesh position={[0, 8, 0]}><boxGeometry args={[18, 0.2, 0.3]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
        {/* Crane trolley */}
        <mesh position={[3, 7.5, 0]}><boxGeometry args={[2, 1, 2]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      </group>

      {/* Lamp room / bath house */}
      <group position={[-20, 0, 40]}>
        <mesh position={[0, 3.5, 0]} castShadow><boxGeometry args={[12, 7, 10]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
        <mesh position={[0, 7.5, 0]}><boxGeometry args={[13, 1, 11]} /><meshStandardMaterial color="#8b9598" roughness={0.4} metalness={0.5} /></mesh>
        {[-3,0,3].map((x,i) => (<mesh key={`lw${i}`} position={[x, 3.5, 5.1]}><planeGeometry args={[1.5, 1.5]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.5} /></mesh>))}
        <ClickableLabel position={[0, 9, 0]} label="Lamp Room" color="#94a3b8" onClick={() => onInfraClick('lamp_room')} />
      </group>

      {/* Explosive store (surface) */}
      <group position={[100, 0, -60]}>
        <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[8, 5, 6]} /><meshStandardMaterial color="#8b4040" roughness={0.7} metalness={0.3} /></mesh>
        <mesh position={[0, 5.5, 0]}><coneGeometry args={[5.5, 2, 4]} /><meshStandardMaterial color="#8b4040" roughness={0.7} /></mesh>
        {/* Security fence */}
        {Array.from({length:12},(_, i) => {
          const ea = (i/12)*Math.PI*2; const er = 12;
          return (<mesh key={`efence${i}`} position={[Math.cos(ea)*er, 1, Math.sin(ea)*er]}><cylinderGeometry args={[0.06, 0.06, 2, 4]} /><meshStandardMaterial color="#8a8a80" roughness={0.7} metalness={0.3} /></mesh>);
        })}
        <ClickableLabel position={[0, 7, 0]} label="Explosive Store" color="#ef4444" onClick={() => onInfraClick('explosive_store')} />
      </group>

      {/* Surface conveyor from shaft to CHP */}
      <group>
        {(() => {
          const convCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(5,1,5), new THREE.Vector3(25,2,15), new THREE.Vector3(50,3,28), new THREE.Vector3(70,4,35)]);
          return (<group>
            <mesh geometry={new THREE.TubeGeometry(convCurve, 30, 0.8, 6, false)}><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
            {convCurve.getPoints(10).map((p,i) => (
              <mesh key={`cvleg${i}`} position={[p.x, p.y/2, p.z]}><cylinderGeometry args={[0.15, 0.15, p.y, 4]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>
            ))}
          </group>);
        })()}
      </group>
    </group>
  );
}

// ================================================================
// ANIMATED WATER SEEPAGE EFFECT
// ================================================================
function WaterSeepageEffect({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Points>(null);
  const count = 30;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { p[i*3] = (Math.random()-0.5)*4; p[i*3+1] = Math.random()*8; p[i*3+2] = (Math.random()-0.5)*4; }
    return p;
  }, []);

  useFrame(() => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) - 0.08;
      if (y < -3) y = 8;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={ref}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial size={0.25} color="#3b82f6" transparent opacity={0.6} sizeAttenuation />
      </points>
      <Html position={[0, 10, 0]} center>
        <div className="text-[8px] text-blue-400 bg-blue-500/15 px-2 py-1 rounded border border-blue-500/30 whitespace-nowrap pointer-events-none animate-pulse">
          ⚠ Water Seepage - 45 L/min
        </div>
      </Html>
    </group>
  );
}

// ================================================================
// ANIMATED GAS CLOUD EFFECT
// ================================================================
function GasCloudEffect({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.scale.x = 1 + Math.sin(s.clock.elapsedTime * 0.5) * 0.15;
      ref.current.scale.z = 1 + Math.cos(s.clock.elapsedTime * 0.3) * 0.1;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.15 + Math.sin(s.clock.elapsedTime * 0.8) * 0.05;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[8, 12, 12]} />
        <meshStandardMaterial color="#ef4444" transparent opacity={0.15} roughness={1} />
      </mesh>
      <Html position={[0, 12, 0]} center>
        <div className="text-[8px] text-red-400 bg-red-500/15 px-2 py-1 rounded border border-red-500/40 whitespace-nowrap pointer-events-none animate-pulse font-bold">
          ⚠ CH₄ 1.2% — Approaching Limit
        </div>
      </Html>
    </group>
  );
}

// ================================================================
// DUST PARTICLES
// ================================================================
function DustParticles({ intensity }: { intensity: number }) {
  const ref = useRef<THREE.Points>(null);
  const count = intensity;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { p[i*3] = (Math.random()-0.5)*200; p[i*3+1] = Math.random()*30; p[i*3+2] = (Math.random()-0.5)*200; }
    return p;
  }, [count]);

  useFrame((s) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      pos.setX(i, pos.getX(i) + Math.sin(s.clock.elapsedTime * 0.1 + i) * 0.02);
      let y = pos.getY(i) + 0.01; if (y > 30) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.3} color="#8b7355" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// ================================================================
// OPEN-PIT INFRASTRUCTURE (with ClickableLabel instead of group onClick)
// ================================================================
function ProcessingPlant({ onClick }: { onClick: () => void }) {
  return (
    <group position={[185, 0, 65]}>
      <mesh position={[0, 6, 0]} castShadow><boxGeometry args={[28, 14, 20]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} /></mesh>
      {[-10,-5,0,5,10].map((x,i) => (<mesh key={i} position={[x, 8, 10.1]}><planeGeometry args={[2.5, 3]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.5} /></mesh>))}
      <mesh position={[-16, 5, 0]} castShadow><boxGeometry args={[7, 10, 9]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
      <mesh position={[-16, 11, 0]} castShadow><cylinderGeometry args={[2.5, 3.5, 3.5, 8]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[16, 8, 0]} castShadow><boxGeometry args={[6, 18, 7]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
      {[4,10,-4].map((z,i) => (<mesh key={`s${i}`} position={[24, 8, z]} castShadow><cylinderGeometry args={[4, 4, 16, 16]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>))}
      {[4,10,-4].map((z,i) => (<mesh key={`st${i}`} position={[24, 16.5, z]}><coneGeometry args={[4.3, 3.5, 16]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.5} /></mesh>))}
      <mesh position={[-20, 14, 7]} castShadow><cylinderGeometry args={[1, 1.6, 28, 8]} /><meshStandardMaterial color="#b0b8a0" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[0, 14, 0]}><boxGeometry args={[32, 0.2, 24]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} transparent opacity={0.7} /></mesh>
      {/* Stairs/ladders */}
      {Array.from({length:6},(_, i) => (<mesh key={`stair${i}`} position={[-16, 1+i*1.6, -5]}><boxGeometry args={[2, 0.15, 1]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>))}
      {/* Pipe racks */}
      <mesh position={[5, 14.5, -12]} rotation={[0, 0, 0]}><boxGeometry args={[20, 0.2, 0.2]} /><meshStandardMaterial color="#5b9cf6" roughness={0.3} metalness={0.5} /></mesh>
      <mesh position={[5, 14.8, -12]}><boxGeometry args={[20, 0.2, 0.2]} /><meshStandardMaterial color="#ef6464" roughness={0.3} metalness={0.5} /></mesh>
      {/* Dust suppression water line */}
      <mesh position={[5, 13.5, 12]}><boxGeometry args={[20, 0.15, 0.15]} /><meshStandardMaterial color="#2a7dac" roughness={0.3} metalness={0.5} /></mesh>
      {/* Ventilation ducts on roof */}
      {[-5, 5].map((x, i) => (<mesh key={`duct${i}`} position={[x, 14.5, 0]}><boxGeometry args={[2, 2, 18]} /><meshStandardMaterial color="#8b9598" roughness={0.5} metalness={0.4} /></mesh>))}
      {/* Control room */}
      <mesh position={[-5, 3, -12]} castShadow><boxGeometry args={[6, 6, 4]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={[-5, 3, -14.1]}><planeGeometry args={[4, 3]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.4} /></mesh>
      {/* Feed hopper */}
      <mesh position={[-22, 8, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[4, 6, 8, 1, true]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} side={THREE.DoubleSide} /></mesh>
      <ClickableLabel position={[0, 18, 0]} label="Coal Handling Plant" color="#22d3ee" onClick={onClick} />
    </group>
  );
}

function Workshop({ onClick }: { onClick: () => void }) {
  return (
    <group position={[-185, 0, 118]}>
      <mesh position={[0, 5, 0]} castShadow><boxGeometry args={[26, 10, 18]} /><meshStandardMaterial color="#74706c" roughness={0.7} metalness={0.3} /></mesh>
      <mesh position={[0, 10.5, 0]}><boxGeometry args={[28, 1.5, 20]} /><meshStandardMaterial color="#87837e" roughness={0.6} metalness={0.4} /></mesh>
      {[-10,-5,0,5,10].map((x,i) => (<mesh key={i} position={[x, 4, 9.1]}><planeGeometry args={[3.5, 6]} /><meshStandardMaterial color={i < 3 ? '#a86f1f' : '#7a7a82'} roughness={0.6} /></mesh>))}
      <mesh position={[0, 8.5, 0]}><boxGeometry args={[24, 0.4, 0.5]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
      <mesh position={[4, 8, 0]} castShadow><boxGeometry args={[3, 2, 4]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      {/* Overhead crane */}
      <mesh position={[0, 9.5, 0]}><boxGeometry args={[22, 0.3, 0.5]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
      <mesh position={[-5, 8.5, 0]}><boxGeometry args={[3, 2, 3]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      {/* Tool storage racks */}
      {[-10, -6, 6, 10].map((x, i) => (<mesh key={`rack${i}`} position={[x, 2.5, -8.5]}><boxGeometry args={[2, 5, 0.5]} /><meshStandardMaterial color="#555" roughness={0.6} metalness={0.3} /></mesh>))}
      {/* Workbenches */}
      {[-8, 0, 8].map((x, i) => (<mesh key={`bench${i}`} position={[x, 1.5, 0]}><boxGeometry args={[4, 0.3, 2]} /><meshStandardMaterial color="#74706c" roughness={0.7} metalness={0.3} /></mesh>))}
      {/* Welding bay partition */}
      <mesh position={[10, 3, 0]}><boxGeometry args={[0.2, 6, 8]} /><meshStandardMaterial color="#555" roughness={0.7} /></mesh>
      {/* Wash bay */}
      <mesh position={[-11, 0.1, 6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[5, 8]} /><meshStandardMaterial color="#4a5a68" roughness={0.3} /></mesh>
      <ClickableLabel position={[0, 12, 0]} label="Workshop" color="#f97316" onClick={onClick} />
    </group>
  );
}

function AdminBuilding({ onClick }: { onClick: () => void }) {
  return (
    <group position={[-205, 0, -138]}>
      <mesh position={[0, 5, 0]} castShadow><boxGeometry args={[18, 10, 14]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={[0, 10.5, 0]}><boxGeometry args={[19, 1.2, 15]} /><meshStandardMaterial color="#8b9598" roughness={0.4} metalness={0.5} /></mesh>
      {/* Ground floor windows */}
      {[-5,-2,1,4].map((x,i) => (<mesh key={`g${i}`} position={[x, 3, 7.1]}><planeGeometry args={[2.2, 2.2]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.6} /></mesh>))}
      {/* First floor windows */}
      {[-5,-2,1,4].map((x,i) => (<mesh key={`f${i}`} position={[x, 7, 7.1]}><planeGeometry args={[2.2, 2.2]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.5} /></mesh>))}
      {/* Rear windows */}
      {[-5,-2,1,4].map((x,i) => (<mesh key={`r${i}`} position={[x, 5, -7.1]}><planeGeometry args={[2, 2]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.3} /></mesh>))}
      {/* Parking lot */}
      <mesh position={[0, 0.02, 12]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[20, 10]} /><meshStandardMaterial color="#4a4a50" roughness={0.85} /></mesh>
      {/* Parked vehicles */}
      {[[-5,0.6,12],[0,0.6,12],[5,0.6,12]].map(([x,y,z],i) => (<mesh key={i} position={[x,y,z]}><boxGeometry args={[2.5, 1.2, 4]} /><meshStandardMaterial color={['#5b9cf6','#ef6464','#f5b830'][i]} roughness={0.4} metalness={0.5} /></mesh>))}
      {[[-5,1.4,11.5],[0,1.4,11.5],[5,1.4,11.5]].map(([x,y,z],i) => (<mesh key={`cab${i}`} position={[x,y,z]}><boxGeometry args={[1.8, 0.8, 2]} /><meshStandardMaterial color={['#5b9cf6','#ef6464','#f5b830'][i]} roughness={0.4} metalness={0.5} /></mesh>))}
      {/* Entrance canopy */}
      <mesh position={[0, 4, 7.5]}><boxGeometry args={[5, 0.3, 3]} /><meshStandardMaterial color="#8b9598" roughness={0.4} metalness={0.5} /></mesh>
      {[-2, 2].map((x, i) => (<mesh key={`cpillar${i}`} position={[x, 2, 8.5]}><cylinderGeometry args={[0.15, 0.15, 4, 6]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>))}
      {/* Door */}
      <mesh position={[0, 1.8, 7.15]}><planeGeometry args={[2, 3.5]} /><meshStandardMaterial color="#3a4a5a" roughness={0.5} /></mesh>
      {/* AC units on roof */}
      {[-5, 5].map((x, i) => (<mesh key={`acu${i}`} position={[x, 11.5, 0]}><boxGeometry args={[2.5, 1.5, 2.5]} /><meshStandardMaterial color="#8b9598" roughness={0.5} metalness={0.5} /></mesh>))}
      {/* Satellite dish */}
      <mesh position={[8, 10, -5]} rotation={[0.3, 0, 0]}><circleGeometry args={[1.2, 12]} /><meshStandardMaterial color="#b0b8a0" roughness={0.4} metalness={0.6} /></mesh>
      <mesh position={[8, 9, -5]}><cylinderGeometry args={[0.08, 0.08, 2, 4]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
      <ClickableLabel position={[0, 12, 0]} label="Admin Office" color="#60a5fa" onClick={onClick} />
    </group>
  );
}

function FuelStation({ onClick }: { onClick: () => void }) {
  return (
    <group position={[-140, 0, -98]}>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[24, 16]} /><meshStandardMaterial color="#677181" roughness={0.7} /></mesh>
      {/* Main tank */}
      <mesh position={[0, 3.5, 0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[3.5, 3.5, 12, 16]} /><meshStandardMaterial color="#dc4444" roughness={0.4} metalness={0.5} /></mesh>
      {/* Tank cradles */}
      {[-3.5,3.5].map((x,i) => (<mesh key={i} position={[x, 1.5, 0]}><boxGeometry args={[0.6, 3, 4.5]} /><meshStandardMaterial color="#7a7a82" roughness={0.6} metalness={0.4} /></mesh>))}
      {/* Secondary tank */}
      <mesh position={[8, 3.5, 0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[3.5, 3.5, 12, 16]} /><meshStandardMaterial color="#dc4444" roughness={0.4} metalness={0.5} /></mesh>
      {/* Tank end caps */}
      {[-6.5, 6.5, 1.5, 14.5].map((x, i) => (<mesh key={`cap${i}`} position={[x, 3.5, 0]} rotation={[0, 0, Math.PI/2]}><circleGeometry args={[3.5, 16]} /><meshStandardMaterial color="#cc3a3a" roughness={0.4} metalness={0.5} /></mesh>))}
      {/* Dispensing pumps */}
      {[-2,1.5,5,8.5].map((_,i) => (<mesh key={i} position={[-2+i*3.5, 1.5, 7]}><boxGeometry args={[1.2, 3.5, 1.2]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.4} /></mesh>))}
      {/* Hose nozzles */}
      {[-2,1.5,5,8.5].map((_,i) => (<mesh key={`hose${i}`} position={[-2+i*3.5, 2.5, 7.8]}><boxGeometry args={[0.15, 0.6, 0.8]} /><meshStandardMaterial color="#3a3a3a" roughness={0.6} /></mesh>))}
      {/* Canopy */}
      <mesh position={[3, 6, 7]}><boxGeometry args={[18, 0.3, 8]} /><meshStandardMaterial color="#8b9598" roughness={0.5} metalness={0.4} /></mesh>
      {[-5, 11].map((x, i) => (<mesh key={`fpillar${i}`} position={[x, 3, 7]}><cylinderGeometry args={[0.2, 0.2, 6, 6]} /><meshStandardMaterial color="#7a7a82" roughness={0.5} metalness={0.4} /></mesh>))}
      {/* Bund wall around tanks */}
      <mesh position={[4, 0.4, 0]}><boxGeometry args={[22, 0.8, 0.3]} /><meshStandardMaterial color="#8a8a80" roughness={0.8} /></mesh>
      <mesh position={[4, 0.4, 0]} rotation={[0, Math.PI/2, 0]}><boxGeometry args={[10, 0.8, 0.3]} /><meshStandardMaterial color="#8a8a80" roughness={0.8} /></mesh>
      <ClickableLabel position={[4, 8, 0]} label="Fuel Depot" color="#ef4444" onClick={onClick} />
    </group>
  );
}

function WeighBridge({ onClick }: { onClick: () => void }) {
  return (
    <group position={[140, 0, -98]}>
      {/* Platform */}
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[16, 0.6, 6]} /><meshStandardMaterial color="#8b9280" roughness={0.3} metalness={0.7} /></mesh>
      {/* Load cells (visible underneath) */}
      {[-6, -2, 2, 6].map((x, i) => [-2, 2].map((z, j) => (
        <mesh key={`lc${i}_${j}`} position={[x, -0.1, z]}><cylinderGeometry args={[0.3, 0.3, 0.4, 6]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
      )))}
      {/* Approach ramps */}
      <mesh position={[-9, 0.15, 0]} rotation={[0, 0, 0.02]}><boxGeometry args={[4, 0.3, 6]} /><meshStandardMaterial color="#5a534a" roughness={0.8} /></mesh>
      <mesh position={[9, 0.15, 0]} rotation={[0, 0, -0.02]}><boxGeometry args={[4, 0.3, 6]} /><meshStandardMaterial color="#5a534a" roughness={0.8} /></mesh>
      {/* Control cabin */}
      <mesh position={[-10, 3.5, 0]} castShadow><boxGeometry args={[5, 7, 5]} /><meshStandardMaterial color="#7b8593" roughness={0.6} metalness={0.4} /></mesh>
      <mesh position={[-8, 4.5, 0]}><planeGeometry args={[2, 2.5]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.5} /></mesh>
      {/* Display board */}
      <mesh position={[5, 4, 4]}><boxGeometry args={[3, 2, 0.3]} /><meshStandardMaterial color="#1a2a3a" roughness={0.3} metalness={0.2} /></mesh>
      <mesh position={[5, 4, 4.2]}><planeGeometry args={[2.5, 1.5]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} /></mesh>
      {/* Boom barriers */}
      {[-7, 7].map((x, i) => (
        <group key={`boom${i}`}>
          <mesh position={[x, 1.5, 4]}><cylinderGeometry args={[0.15, 0.15, 3, 6]} /><meshStandardMaterial color="#f5b830" roughness={0.5} /></mesh>
          <mesh position={[x, 3, 4+(i===0?2:-2)]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.08, 0.08, 4, 4]} /><meshStandardMaterial color="#f5b830" roughness={0.5} /></mesh>
        </group>
      ))}
      <ClickableLabel position={[0, 6, 0]} label="Weigh Bridge" color="#94a3b8" onClick={onClick} />
    </group>
  );
}

function CoalStockpiles({ onClick }: { onClick: () => void }) {
  return (
    <group position={[130, 0, 140]}>
      {[{x:55,z:45,h:14,r:14},{x:70,z:55,h:11,r:11},{x:42,z:55,h:16,r:16},{x:74,z:38,h:10,r:10},{x:35,z:42,h:8,r:8},{x:82,z:50,h:9,r:9}].map((p,i) => (
        <group key={i}>
          <mesh position={[p.x, p.h/2, p.z]} castShadow><coneGeometry args={[p.r, p.h, 12]} /><meshStandardMaterial color={i===3?'#3a3218':i%2===0?'#1a1a1a':'#222222'} roughness={0.95} /></mesh>
          {Array.from({length:8},(_, j) => {
            const a = (j/8)*Math.PI*2; const pr = p.r*0.6;
            return <mesh key={j} position={[p.x+Math.cos(a)*pr, p.h*0.3, p.z+Math.sin(a)*pr]}><sphereGeometry args={[0.8+j*0.1,4,4]} /><meshStandardMaterial color="#181818" roughness={0.95} /></mesh>;
          })}
        </group>
      ))}
      {/* Stacker/reclaimer crane */}
      <mesh position={[58, 6, 48]} castShadow><boxGeometry args={[3.5, 12, 3.5]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[58, 12, 48]} rotation={[0.2, 0.5, 0]}><boxGeometry args={[24, 0.6, 0.6]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      {/* Boom supports */}
      <mesh position={[58, 11, 48]} rotation={[0.1, 0.5, 0]}><boxGeometry args={[20, 0.3, 0.3]} /><meshStandardMaterial color="#f5b830" roughness={0.4} metalness={0.5} /></mesh>
      {/* Counterweight */}
      <mesh position={[50, 11, 44]}><boxGeometry args={[3, 2, 2]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
      {/* Conveyor feeding stockyard */}
      <mesh position={[40, 3, 50]} rotation={[0, 0.3, 0.1]}><boxGeometry args={[25, 0.4, 2]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
      {Array.from({length:5},(_, i) => (<mesh key={`cvl${i}`} position={[32+i*4, 1.5, 48+i*0.5]}><cylinderGeometry args={[0.15, 0.15, 3, 4]} /><meshStandardMaterial color="#8b9280" roughness={0.5} metalness={0.4} /></mesh>))}
      {/* Perimeter bund walls */}
      {[[30,0.5,35,50,1,0.3],[30,0.5,65,50,1,0.3],[90,0.5,50,0.3,1,30],[28,0.5,50,0.3,1,30]].map(([x,y,z,w,h,d],i) => (
        <mesh key={`bund${i}`} position={[x,y,z]}><boxGeometry args={[w,h,d]} /><meshStandardMaterial color="#6d6050" roughness={0.9} /></mesh>
      ))}
      <ClickableLabel position={[58, 16, 48]} label="Coal Stockyard" color="#eab308" onClick={onClick} />
    </group>
  );
}

function SettlingPond({ onClick }: { onClick: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => { if (ref.current) { ref.current.position.y = -0.3 + Math.sin(s.clock.elapsedTime * 0.3) * 0.1; } });
  return (
    <group position={[-85, 0, 165]}>
      {/* Embankment ring – all positions relative to group origin */}
      <mesh position={[0, 1.2, 0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[20, 24, 32]} /><meshStandardMaterial color="#6d6050" roughness={0.8} /></mesh>
      {/* Water surface */}
      <mesh ref={ref} position={[0, -0.3, 0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[20, 32]} /><meshStandardMaterial color="#2a7dac" roughness={0.1} metalness={0.5} transparent opacity={0.7} /></mesh>
      {/* Inlet pipe (+x side) */}
      <mesh position={[22, 2, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.5, 0.5, 10, 8]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
      {/* Outlet pipe (-x side) */}
      <mesh position={[-22, 1.5, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.4, 0.4, 8, 8]} /><meshStandardMaterial color="#7b8593" roughness={0.5} metalness={0.5} /></mesh>
      {/* Baffle walls */}
      <mesh position={[5, 0.5, 0]}><boxGeometry args={[0.3, 1.5, 25]} /><meshStandardMaterial color="#8a8a80" roughness={0.7} /></mesh>
      <mesh position={[-5, 0.5, 0]}><boxGeometry args={[0.3, 1.5, 25]} /><meshStandardMaterial color="#8a8a80" roughness={0.7} /></mesh>
      {/* Access walkway */}
      <mesh position={[0, 1.8, -22]}><boxGeometry args={[2, 0.15, 8]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>
      {[-1, 1].map((x, i) => (<mesh key={`prail${i}`} position={[x, 2.5, -22]}><boxGeometry args={[0.06, 1.2, 8]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.4} /></mesh>))}
      {/* Sediment marker posts */}
      {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((a, i) => (
        <mesh key={`smark${i}`} position={[Math.cos(a)*18, 1.5, Math.sin(a)*18]}><cylinderGeometry args={[0.08, 0.08, 3, 4]} /><meshStandardMaterial color="#ef4444" roughness={0.5} /></mesh>
      ))}
      <ClickableLabel position={[0, 5, 0]} label="Settling Pond" color="#3b82f6" onClick={onClick} />
    </group>
  );
}

function RailSiding({ onClick }: { onClick: () => void }) {
  return (
    <group position={[215, 0, -58]}>
      {/* Ballast bed */}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[65, 12]} /><meshStandardMaterial color="#6d6050" roughness={0.85} /></mesh>
      {/* Rails (4 rails for 2 tracks) */}
      {[-3,-1.5,1.5,3].map((z,i) => (<mesh key={i} position={[0, 0.35, z]}><boxGeometry args={[65, 0.15, 0.12]} /><meshStandardMaterial color="#b0b8a0" roughness={0.2} metalness={0.8} /></mesh>))}
      {/* Sleepers */}
      {Array.from({length:30},(_, i) => (<mesh key={i} position={[-28+i*2, 0.18, 0]}><boxGeometry args={[0.35, 0.18, 8]} /><meshStandardMaterial color="#74706c" roughness={0.8} /></mesh>))}
      {/* Loading silo/hopper */}
      <mesh position={[5, 7, 0]} castShadow><boxGeometry args={[10, 14, 7]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} /></mesh>
      <mesh position={[5, 1, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[4, 3, 4, 1, true]} /><meshStandardMaterial color="#677181" roughness={0.6} metalness={0.4} side={THREE.DoubleSide} /></mesh>
      {/* Conveyor feeding hopper */}
      <mesh position={[5, 14, -8]} rotation={[0.3, 0, 0]}><boxGeometry args={[3, 0.3, 14]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
      {/* Wagons */}
      {Array.from({length:6},(_, i) => (
        <group key={i}>
          <mesh position={[-20+i*7, 1.8, -2.25]} castShadow><boxGeometry args={[6, 3, 3]} /><meshStandardMaterial color="#7a7a82" roughness={0.6} metalness={0.4} /></mesh>
          {i<4 && <mesh position={[-20+i*7, 3.5, -2.25]}><boxGeometry args={[5.5, 1, 2.5]} /><meshStandardMaterial color="#1a1a1a" roughness={0.9} /></mesh>}
          {/* Wheels */}
          {[-2,2].map((wx, wi) => (
            <mesh key={`wh${wi}`} position={[-20+i*7+wx, 0.4, -2.25]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.3, 8]} /><meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.6} /></mesh>
          ))}
          {/* Couplings */}
          {i < 5 && <mesh position={[-20+i*7+3.2, 1, -2.25]}><boxGeometry args={[1.2, 0.2, 0.2]} /><meshStandardMaterial color="#5a5a5a" roughness={0.5} metalness={0.5} /></mesh>}
        </group>
      ))}
      {/* Buffer stops at end of track */}
      <mesh position={[-32, 1, -2.25]}><boxGeometry args={[0.5, 2, 4]} /><meshStandardMaterial color="#ef4444" roughness={0.5} /></mesh>
      <mesh position={[32, 1, -2.25]}><boxGeometry args={[0.5, 2, 4]} /><meshStandardMaterial color="#ef4444" roughness={0.5} /></mesh>
      {/* Signal post */}
      <mesh position={[25, 3, 5]}><cylinderGeometry args={[0.1, 0.1, 6, 4]} /><meshStandardMaterial color="#5a534a" roughness={0.7} /></mesh>
      <mesh position={[25, 6, 5]}><sphereGeometry args={[0.3, 6, 6]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} /></mesh>
      <ClickableLabel position={[0, 16, 0]} label="Rail Siding" color="#22c55e" onClick={onClick} />
    </group>
  );
}

function PowerSubstation({ onClick }: { onClick: () => void }) {
  return (
    <group position={[-100, 0, -175]}>
      {/* Main transformer building */}
      <mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[12, 9, 10]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>
      {/* Transformer units */}
      {[-10,10].map((x,i) => (
        <group key={`txfmr${i}`}>
          <mesh position={[x, 3.5, 0]} castShadow><boxGeometry args={[5, 7, 5]} /><meshStandardMaterial color="#7b8593" roughness={0.4} metalness={0.5} /></mesh>
          {/* Cooling fins */}
          {[-2,-1,0,1,2].map((z,fi) => (<mesh key={fi} position={[x, 3.5, z]}><boxGeometry args={[5.2, 6, 0.08]} /><meshStandardMaterial color="#8b9280" roughness={0.4} metalness={0.5} /></mesh>))}
          {/* Bushings on top */}
          {[-1, 0, 1].map((bx, bi) => (<mesh key={`bush${bi}`} position={[x+bx, 7.5, 0]}><cylinderGeometry args={[0.15, 0.25, 2, 6]} /><meshStandardMaterial color="#8a7a5e" roughness={0.4} metalness={0.5} /></mesh>))}
        </group>
      ))}
      {/* Transmission towers with lines */}
      {[0,12,-12].map((z,i) => (
        <group key={i}>
          <mesh position={[15, 12, z]}><cylinderGeometry args={[0.2, 0.3, 24, 6]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
          <mesh position={[15, 22, z]}><boxGeometry args={[0.2, 0.2, 7]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
          {/* Cross arms */}
          <mesh position={[15, 18, z]}><boxGeometry args={[6, 0.15, 0.15]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>
          {/* Insulators */}
          {[-2, 0, 2].map((ix, ii) => (<mesh key={`ins${ii}`} position={[15+ix, 18.5, z]}><cylinderGeometry args={[0.12, 0.08, 0.6, 6]} /><meshStandardMaterial color="#8a7a5e" roughness={0.5} metalness={0.3} /></mesh>))}
        </group>
      ))}
      {/* Perimeter fence */}
      {Array.from({length:16},(_, i) => {
        const angle = (i/16)*Math.PI*2; const fr = 18;
        return (<mesh key={`pfence${i}`} position={[Math.cos(angle)*fr, 1, Math.sin(angle)*fr]}><cylinderGeometry args={[0.06, 0.06, 2, 4]} /><meshStandardMaterial color="#8a8a80" roughness={0.7} metalness={0.3} /></mesh>);
      })}
      {/* Circuit breakers */}
      {[-4, 0, 4].map((z, i) => (<mesh key={`cb${i}`} position={[6, 2.5, z]}><boxGeometry args={[1.5, 3, 1.5]} /><meshStandardMaterial color="#677181" roughness={0.5} metalness={0.5} /></mesh>))}
      {/* Warning signs */}
      <mesh position={[0, 5, -5.1]}><planeGeometry args={[2, 1.5]} /><meshStandardMaterial color="#f5b830" roughness={0.6} /></mesh>
      <ClickableLabel position={[0, 10, 0]} label="Power Substation" color="#eab308" onClick={onClick} />
    </group>
  );
}



// ================================================================
// EQUIPMENT MESHES
// ================================================================
interface EquipMeshProps { equipment: Equipment; onClick: (eq: Equipment) => void; }
function getStatusColor(s: string) { return s === 'running' ? '#f59e0b' : s === 'breakdown' ? '#ef4444' : s === 'maintenance' ? '#3b82f6' : '#6b7280'; }

function ExcavatorMesh({ equipment, onClick }: EquipMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Mesh>(null);
  const prevPos = useRef<{ x: number; z: number } | null>(null);
  const isRunning = equipment.status === 'running';
  const c = getStatusColor(equipment.status);
  useFrame((s) => {
    if (armRef.current && isRunning) { armRef.current.rotation.z = -0.3 + Math.sin(s.clock.elapsedTime * 0.2) * 0.15; }
    if (groupRef.current && isRunning) {
      const t = s.clock.elapsedTime * 0.08 + equipment.position.z * 0.05;
      const cycle = ((t % (Math.PI * 4)) / (Math.PI * 4));
      const progress = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
      const angle = t * 0.8;
      const baseR = 40 - progress * 25;
      const y = -2 - progress * 30;
      const nx = Math.cos(angle) * baseR;
      const nz = Math.sin(angle) * baseR;
      groupRef.current.position.set(nx, y, nz);
      if (prevPos.current) {
        const dx = nx - prevPos.current.x;
        const dz = nz - prevPos.current.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          groupRef.current.rotation.y = Math.atan2(dx, dz);
        }
      }
      prevPos.current = { x: nx, z: nz };
    }
  });
  return (
    <group ref={groupRef} position={[equipment.position.x, equipment.position.y - 10, equipment.position.z]}>
      {/* Tracks */}
      {[2,-2].map((z,i) => (<mesh key={i} position={[0,0.4,z]}><boxGeometry args={[6,0.8,1]} /><meshStandardMaterial color="#2a2a2a" /></mesh>))}
      {/* Track rollers */}
      {[2,-2].map((z,i) => [-2,0,2].map((x,j) => (<mesh key={`tr${i}_${j}`} position={[x,0.4,z]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.3,0.3,0.2,8]} /><meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.6} /></mesh>)))}
      {/* Body/house */}
      <mesh position={[0,2.2,0]} castShadow><boxGeometry args={[5,3,3.5]} /><meshStandardMaterial color={c} roughness={0.5} metalness={0.4} /></mesh>
      {/* Cab */}
      <mesh position={[0.5,4.5,0]} castShadow><boxGeometry args={[2.5,2.5,2.5]} /><meshStandardMaterial color={c} roughness={0.4} metalness={0.5} /></mesh>
      {/* Cab windows */}
      <mesh position={[0.5,4.5,1.3]}><planeGeometry args={[2, 1.5]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.3} /></mesh>
      {/* Boom */}
      <mesh ref={armRef} position={[-3.5,4.5,0]} rotation={[0,0,-0.3]} castShadow><boxGeometry args={[7,0.8,0.8]} /><meshStandardMaterial color={c} roughness={0.4} metalness={0.5} /></mesh>
      {/* Bucket */}
      <mesh position={[-8.5,1,0]} castShadow><boxGeometry args={[2,1.5,2.5]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>
      {/* Bucket teeth */}
      {[-0.8,-0.4,0,0.4,0.8].map((z,i) => (<mesh key={`tooth${i}`} position={[-9.5,0.3,z]}><coneGeometry args={[0.1,0.4,4]} /><meshStandardMaterial color="#b0b8a0" roughness={0.3} metalness={0.7} /></mesh>))}
      {/* Hydraulic cylinders */}
      <mesh position={[-1.5,3.5,0.8]} rotation={[0,0,-0.6]}><cylinderGeometry args={[0.12,0.12,3,6]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} /></mesh>
      <mesh position={[-1.5,3.5,-0.8]} rotation={[0,0,-0.6]}><cylinderGeometry args={[0.12,0.12,3,6]} /><meshStandardMaterial color="#c0c8b0" roughness={0.3} metalness={0.7} /></mesh>
      {/* Counterweight */}
      <mesh position={[3,2.5,0]}><boxGeometry args={[1.5,2,3]} /><meshStandardMaterial color="#3a3a3a" roughness={0.7} /></mesh>
      {/* Exhaust stack */}
      <mesh position={[1.5,5.8,1]}><cylinderGeometry args={[0.1,0.1,1.2,5]} /><meshStandardMaterial color="#555" roughness={0.7} /></mesh>
      <Html position={[0,6,0]} center>
        <div onClick={(e) => { e.stopPropagation(); onClick(equipment); }}
          className={`text-[8px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap cursor-pointer hover:scale-110 transition-all ${isRunning ? 'bg-green-500/20 text-green-400 border border-green-500/40' : equipment.status === 'breakdown' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-700/50 text-slate-400 border border-slate-600'}`}>
          {equipment.name} | {equipment.utilization.toFixed(2)}%
        </div>
      </Html>
    </group>
  );
}

function DumpTruckMesh({ equipment, onClick }: EquipMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const prevPos = useRef<{ x: number; z: number } | null>(null);
  const isRunning = equipment.status === 'running';
  const c = getStatusColor(equipment.status);
  useFrame((s) => {
    if (groupRef.current && isRunning) {
      const t = s.clock.elapsedTime * 0.1 + equipment.position.x * 0.08;
      const cycle = ((t % (Math.PI * 4)) / (Math.PI * 4));
      const progress = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
      const angle = t * 0.9;
      const baseR = 45 - progress * 28;
      const y = -2 - progress * 28;
      const nx = Math.cos(angle) * baseR;
      const nz = Math.sin(angle) * baseR;
      groupRef.current.position.set(nx, y, nz);
      if (prevPos.current) {
        const dx = nx - prevPos.current.x;
        const dz = nz - prevPos.current.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          groupRef.current.rotation.y = Math.atan2(dx, dz);
        }
      }
      prevPos.current = { x: nx, z: nz };
    }
  });
  return (
    <group ref={groupRef} position={[equipment.position.x, equipment.position.y - 10, equipment.position.z]}>
      {/* Chassis */}
      <mesh position={[0,1,0]}><boxGeometry args={[8,0.8,3.5]} /><meshStandardMaterial color="#3a3a3a" /></mesh>
      {/* Cab */}
      <mesh position={[3,3,0]} castShadow><boxGeometry args={[3,3.2,3.2]} /><meshStandardMaterial color={c} roughness={0.4} metalness={0.4} /></mesh>
      {/* Cab window */}
      <mesh position={[4.6,3.5,0]}><planeGeometry args={[2.5, 1.5]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.25} /></mesh>
      {/* Tray/bed */}
      <mesh position={[-1.2,2.5,0]} castShadow><boxGeometry args={[5,2.5,3.2]} /><meshStandardMaterial color={c} roughness={0.5} metalness={0.3} /></mesh>
      {isRunning && <mesh position={[-1.2,4,0]}><boxGeometry args={[4.5,1,2.8]} /><meshStandardMaterial color="#1a1a1a" roughness={0.9} /></mesh>}
      {/* Side boards on tray */}
      {[-1.65, 1.65].map((z, si) => (<mesh key={`sb${si}`} position={[-1.2,3.8,z]}><boxGeometry args={[5,2.5,0.15]} /><meshStandardMaterial color={c} roughness={0.5} metalness={0.3} /></mesh>))}
      {/* Tailgate */}
      <mesh position={[-3.8,2.5,0]}><boxGeometry args={[0.15,2.5,3.2]} /><meshStandardMaterial color={c} roughness={0.5} metalness={0.3} /></mesh>
      {/* Wheels */}
      {[3,-0.5,-3].map((x,i) => [1.8,-1.8].map((z,j) => (<mesh key={`${i}_${j}`} position={[x,0.6,z]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.7,0.7,0.5,12]} /><meshStandardMaterial color="#2a2a2a" /></mesh>)))}
      {/* Mud flaps */}
      {[2, -2].map((z, i) => (<mesh key={`mf${i}`} position={[-3, 0.8, z]}><boxGeometry args={[0.05, 1, 0.5]} /><meshStandardMaterial color="#2a2a2a" roughness={0.9} /></mesh>))}
      {/* Exhaust */}
      <mesh position={[3.5, 5, 1.5]}><cylinderGeometry args={[0.12, 0.12, 1.5, 6]} /><meshStandardMaterial color="#555" roughness={0.7} /></mesh>
      {/* Mirrors */}
      {[1.8, -1.8].map((z, i) => (<mesh key={`mir${i}`} position={[4.5, 3.5, z]}><boxGeometry args={[0.1, 0.4, 0.6]} /><meshStandardMaterial color="#3a3a3a" roughness={0.3} metalness={0.6} /></mesh>))}
      <Html position={[0,5,0]} center>
        <div onClick={(e) => { e.stopPropagation(); onClick(equipment); }}
          className={`text-[8px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap cursor-pointer hover:scale-110 transition-all ${isRunning ? 'bg-green-500/20 text-green-400 border border-green-500/40' : equipment.status === 'breakdown' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-700/50 text-slate-400 border border-slate-600'}`}>
          {equipment.name} | {equipment.utilization.toFixed(2)}%
        </div>
      </Html>
    </group>
  );
}

function ConveyorBelt({ equipment, onClick }: EquipMeshProps) {
  return (
    <group position={[equipment.position.x + 30, equipment.position.y - 5, equipment.position.z + 12]} rotation={[0, 0.5, Math.PI * 0.1]}>
      {/* Belt */}
      <mesh><boxGeometry args={[28, 0.5, 3]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
      {/* Side rails */}
      {[1.6, -1.6].map((z, si) => (<mesh key={`sr${si}`} position={[0, 0.4, z]}><boxGeometry args={[28, 0.3, 0.1]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.4} /></mesh>))}
      {/* Support legs */}
      {[-12,-6,0,6,12].map((x,i) => (<group key={i}><mesh position={[x,-3,1.2]}><boxGeometry args={[0.5,6,0.5]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.4} /></mesh><mesh position={[x,-3,-1.2]}><boxGeometry args={[0.5,6,0.5]} /><meshStandardMaterial color="#f5b830" /></mesh>
        {/* Cross brace */}
        <mesh position={[x,-3,0]} rotation={[0,0,0.2]}><boxGeometry args={[0.2,5,0.2]} /><meshStandardMaterial color="#c9960e" /></mesh>
      </group>))}
      {/* Idler rollers */}
      {[-9,-3,3,9].map((x,ri) => (<mesh key={`r${ri}`} position={[x,-0.3,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.25,0.25,2.8,8]} /><meshStandardMaterial color="#888" metalness={0.6} /></mesh>))}
      {/* Drive motor */}
      <mesh position={[14.5,-1,0]}><boxGeometry args={[1.5,1.2,1.8]} /><meshStandardMaterial color="#4a6a3a" roughness={0.5} metalness={0.5} /></mesh>
      {/* Drive pulley */}
      <mesh position={[14,-0.1,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.5,0.5,2.6,10]} /><meshStandardMaterial color="#666" metalness={0.6} /></mesh>
      {/* Tail pulley */}
      <mesh position={[-14,-0.1,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.4,0.4,2.6,10]} /><meshStandardMaterial color="#666" metalness={0.6} /></mesh>
      {/* Tension weight */}
      <mesh position={[-13.5,-2.5,0]}><boxGeometry args={[1,1.5,1]} /><meshStandardMaterial color="#444" roughness={0.8} /></mesh>
      {/* Guard rails */}
      {[1.8, -1.8].map((z, gi) => (
        <group key={`gr${gi}`}>
          {[-10,-5,0,5,10].map((x, pi) => (<mesh key={pi} position={[x,1.2,z]}><boxGeometry args={[0.1,1.5,0.1]} /><meshStandardMaterial color="#f5b830" /></mesh>))}
          <mesh position={[0,1.8,z]}><boxGeometry args={[22,0.1,0.1]} /><meshStandardMaterial color="#f5b830" /></mesh>
        </group>
      ))}
      <Html position={[0,3,0]} center>
        <div onClick={(e) => { e.stopPropagation(); onClick(equipment); }}
          className="text-[8px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-pointer hover:scale-110 transition-all">
          {equipment.name}
        </div>
      </Html>
    </group>
  );
}

function GenericEquipment({ equipment, onClick }: EquipMeshProps) {
  const c = getStatusColor(equipment.status);
  return (
    <group position={[equipment.position.x, equipment.position.y - 10, equipment.position.z]}>
      {/* Body */}
      <mesh position={[0,1,0]} castShadow><boxGeometry args={[4,1.8,3]} /><meshStandardMaterial color={c} roughness={0.5} metalness={0.4} /></mesh>
      {/* Cab */}
      <mesh position={[0.5,2.7,0]} castShadow><boxGeometry args={[2,2,2.2]} /><meshStandardMaterial color={c} roughness={0.4} metalness={0.5} /></mesh>
      {/* Cab window */}
      <mesh position={[1.55,3,0]}><planeGeometry args={[1.5,1]} /><meshStandardMaterial color="#4a7aaf" emissive="#4a7aaf" emissiveIntensity={0.2} /></mesh>
      {/* Wheels */}
      {[-1.2,1.2].map((x,i) => [1.3,-1.3].map((z,j) => (<mesh key={`w${i}${j}`} position={[x,0.3,z]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.35,0.35,0.3,8]} /><meshStandardMaterial color="#2a2a2a" /></mesh>)))}
      {/* Antenna */}
      <mesh position={[0,4.2,0]}><cylinderGeometry args={[0.03,0.03,1,4]} /><meshStandardMaterial color="#aaa" /></mesh>
      {/* Status beacon */}
      <mesh position={[0,4.7,0]}><sphereGeometry args={[0.1,6,6]} /><meshStandardMaterial color={equipment.status === 'running' ? '#4ade80' : '#ef4444'} emissive={equipment.status === 'running' ? '#4ade80' : '#ef4444'} emissiveIntensity={0.6} /></mesh>
      {/* Exhaust */}
      <mesh position={[-0.8,3.8,0.8]}><cylinderGeometry args={[0.08,0.08,0.8,5]} /><meshStandardMaterial color="#555" /></mesh>
      {/* Hydraulic arm stub */}
      <mesh position={[-1.5,2,0]} rotation={[0,0,0.4]}><boxGeometry args={[2.5,0.3,0.3]} /><meshStandardMaterial color="#f5b830" roughness={0.5} metalness={0.5} /></mesh>
      <Html position={[0,4,0]} center>
        <div onClick={(e) => { e.stopPropagation(); onClick(equipment); }}
          className="text-[8px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600 whitespace-nowrap font-bold cursor-pointer hover:scale-110 transition-all">
          {equipment.name}
        </div>
      </Html>
    </group>
  );
}

// ================================================================
// OPEN PIT SCENE
// ================================================================
function OpenPitScene({ mine, equipmentList, onEquipmentClick, onInfraClick, config }: {
  mine: Mine; equipmentList: Equipment[]; onEquipmentClick: (eq: Equipment) => void; onInfraClick: (id: string) => void; config: MineSceneConfig;
}) {
  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight position={config.sunPosition} intensity={2.5} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-camera-far={500} shadow-camera-left={-250} shadow-camera-right={250} shadow-camera-top={250} shadow-camera-bottom={-250} />
      <directionalLight position={[-80, 100, -60]} intensity={0.8} />
      <directionalLight position={[0, 120, 0]} intensity={0.5} />
      <hemisphereLight args={['#d4ecff', '#8a7a5a', 0.6]} />
      <Sky sunPosition={config.sunPosition} turbidity={config.skyTurbidity} rayleigh={0.5} mieCoefficient={0.005} />

      <OpenPitTerrain config={config} />
      <OpenPitMine mine={mine} onClick={() => onInfraClick('open_pit')} />
      <ProcessingPlant onClick={() => onInfraClick('processing_plant')} />
      <Workshop onClick={() => onInfraClick('workshop')} />
      <AdminBuilding onClick={() => onInfraClick('admin')} />
      <WeighBridge onClick={() => onInfraClick('weigh_bridge')} />
      <FuelStation onClick={() => onInfraClick('fuel_depot')} />
      <CoalStockpiles onClick={() => onInfraClick('coal_stockyard')} />
      <SettlingPond onClick={() => onInfraClick('settling_pond')} />
      <RailSiding onClick={() => onInfraClick('rail_siding')} />
      <PowerSubstation onClick={() => onInfraClick('power_substation')} />
      <DustParticles intensity={config.weatherEffect === 'dusty' ? 250 : config.weatherEffect === 'hazy' ? 150 : 100} />

      {equipmentList.map((eq) => {
        const props = { equipment: eq, onClick: onEquipmentClick };
        switch (eq.type) {
          case 'excavator': return <ExcavatorMesh key={eq.id} {...props} />;
          case 'dump_truck': return <DumpTruckMesh key={eq.id} {...props} />;
          case 'conveyor': return <ConveyorBelt key={eq.id} {...props} />;
          default: return <GenericEquipment key={eq.id} {...props} />;
        }
      })}

      <OrbitControls makeDefault minDistance={20} maxDistance={700} maxPolarAngle={Math.PI / 2.05} target={[0, -5, 0]} enableDamping dampingFactor={0.05} />
    </>
  );
}

// ================================================================
// UNDERGROUND SCENE
// ================================================================
function UndergroundScene({ mine, equipmentList, onEquipmentClick, onInfraClick, config }: {
  mine: Mine; equipmentList: Equipment[]; onEquipmentClick: (eq: Equipment) => void; onInfraClick: (id: string) => void; config: MineSceneConfig;
}) {
  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight position={config.sunPosition} intensity={2.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-camera-far={400} shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={200} shadow-camera-bottom={-200} />
      <directionalLight position={[-60, 90, -40]} intensity={0.7} />
      <directionalLight position={[0, 110, 0]} intensity={0.4} />
      <hemisphereLight args={['#c0d8f0', '#7a6a4a', 0.55]} />
      <Sky sunPosition={config.sunPosition} turbidity={config.skyTurbidity} rayleigh={0.5} mieCoefficient={0.005} />

      <UndergroundTerrain config={config} />
      <UndergroundMineSystem mine={mine} onInfraClick={onInfraClick} />
      <DustParticles intensity={80} />

      {equipmentList.map((eq) => {
        const surfaceEq = { ...eq, position: { ...eq.position, y: 10 } };
        const props = { equipment: surfaceEq, onClick: onEquipmentClick };
        switch (eq.type) {
          case 'excavator': return <ExcavatorMesh key={eq.id} {...props} />;
          case 'dump_truck': return <DumpTruckMesh key={eq.id} {...props} />;
          case 'conveyor': return <ConveyorBelt key={eq.id} {...props} />;
          default: return <GenericEquipment key={eq.id} {...props} />;
        }
      })}

      <OrbitControls makeDefault minDistance={15} maxDistance={400} maxPolarAngle={Math.PI / 1.8} target={[0, -10, 0]} enableDamping dampingFactor={0.05} />
    </>
  );
}

// ================================================================
// ICON MAPS
// ================================================================
const INFRA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  factory: Factory, wrench: Wrench, building: Building2, fuel: Fuel,
  weight: Weight, package: Package, water: Droplets, train: Train,
  power: Power, mountain: Mountain, wind: Wind, flame: Flame,
};

const KPI_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  'Production Rate': Factory, 'Equipment Utilization': Gauge, 'Downtime': Timer,
  'Stripping Ratio': Layers, 'Dispatch Efficiency': Truck, 'Wagon Availability': Train,
  'Cost Per Tonne': DollarSign, 'Safety Score': ShieldAlert, 'Workforce Attendance': HardHat,
};

// ================================================================
// MAIN PAGE COMPONENT
// ================================================================
export default function DigitalTwinMinePage() {
  const params = useParams();
  const router = useRouter();
  const mineId = params.mineId as string;

  const [mine, setMine] = useState<Mine | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [kpis, setKpis] = useState<Record<string, KPIReading>>({});
  const [kpiDefs, setKpiDefs] = useState<KPIDefinition[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [selectedInfra, setSelectedInfra] = useState<string | null>(null);
  const [kpiHistory, setKpiHistory] = useState<Record<string, any[]>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [sideTab, setSideTab] = useState<'kpis' | 'equipment' | 'alerts' | 'warnings'>('kpis');
  const [loaded, setLoaded] = useState(false);

  const isUnderground = mine?.mine_type === 'underground';
  const config = getConfig(mineId);
  const infraDataMap = isUnderground ? UNDERGROUND_INFRA : OPEN_PIT_INFRA;

  useEffect(() => { setTimeout(() => setLoaded(true), 300); }, []);

  useEffect(() => {
    minesApi.get(mineId).then(r => setMine(r.data)).catch(() => router.push('/digital-twin'));
    equipmentApi.list(mineId).then(r => setEquipment(r.data)).catch(() => {});
    kpiApi.current(mineId).then(r => { if (r.data.kpis) setKpis(r.data.kpis); }).catch(() => {});
    kpiApi.definitions().then(r => setKpiDefs(r.data)).catch(() => {});
    alertsApi.list(mineId).then(r => setAlerts(r.data)).catch(() => {});
    advisoryApi.list(mineId).then(r => setAdvisories(r.data)).catch(() => {});
  }, [mineId]);

  useEffect(() => {
    if (!mine) return;
    ['Production Rate', 'Equipment Utilization', 'Safety Score', 'Dispatch Efficiency'].forEach(name => {
      kpiApi.history(mineId, name).then(r => setKpiHistory(prev => ({ ...prev, [name]: r.data.data?.slice(-30) || [] }))).catch(() => {});
    });
  }, [mine, mineId]);

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'kpi_update' && data.mine_id === mineId) setKpis(data.data);
    if (data.type === 'alert' && data.data?.mine_id === mineId) setAlerts(prev => [data.data, ...prev].slice(0, 100));
    if (data.type === 'advisory' && data.data?.mine_id === mineId) setAdvisories(prev => [data.data, ...prev].slice(0, 50));
  }, [mineId]);
  const { connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    const iv = setInterval(() => { equipmentApi.list(mineId).then(r => setEquipment(r.data)).catch(() => {}); }, 5000);
    return () => clearInterval(iv);
  }, [mineId]);

  const handleInfraClick = useCallback((id: string) => { setSelectedInfra(id); setSelectedEq(null); }, []);
  const handleEquipmentClick = useCallback((eq: Equipment) => { setSelectedEq(eq); setSelectedInfra(null); }, []);

  const statusCounts = useMemo(() => ({
    running: equipment.filter(e => e.status === 'running').length,
    idle: equipment.filter(e => e.status === 'idle').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    breakdown: equipment.filter(e => e.status === 'breakdown').length,
  }), [equipment]);

  const kpiList = useMemo(() => Object.entries(kpis).map(([name, kpi]) => {
    const k = typeof kpi === 'object' && 'value' in kpi ? kpi : null;
    return k ? { name: k.kpi_name || name, ...k } : null;
  }).filter(Boolean) as (KPIReading & { name: string })[], [kpis]);

  const radarData = useMemo(() => {
    const metrics = ['Production Rate', 'Equipment Utilization', 'Dispatch Efficiency', 'Safety Score', 'Workforce Attendance'];
    return metrics.map(m => {
      const k = kpis[m]; let val = (k && typeof k === 'object' && 'value' in k) ? k.value : 50;
      if (m === 'Production Rate') val = Math.min(100, val / 5);
      return { metric: m.replace(' Rate', '').replace(' Efficiency', '').replace(' Score', '').replace(' Attendance', ''), value: Math.min(100, Math.max(0, val)) };
    });
  }, [kpis]);

  const equipPieData = useMemo(() => [
    { name: 'Running', value: statusCounts.running, color: '#22c55e' },
    { name: 'Idle', value: statusCounts.idle, color: '#6b7280' },
    { name: 'Maintenance', value: statusCounts.maintenance, color: '#3b82f6' },
    { name: 'Breakdown', value: statusCounts.breakdown, color: '#ef4444' },
  ].filter(d => d.value > 0), [statusCounts]);

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAdvisories = advisories.filter(a => a.status === 'active' && a.severity === 'critical');
  const criticalUgWarnings = isUnderground ? UG_WARNINGS.filter(w => w.severity === 'critical') : [];
  const infraData = selectedInfra ? infraDataMap[selectedInfra] : null;

  // Escape key to close popups
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedInfra) setSelectedInfra(null);
        else if (selectedEq) setSelectedEq(null);
        else if (fullscreen) setFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedInfra, selectedEq, fullscreen]);

  // Entrance animation
  if (!loaded) return (
    <DashboardLayout>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a18]">
        <div className="text-center">
          <Mountain className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-bold text-lg">{mine?.name || 'Loading...'}</p>
          <p className="text-slate-500 text-xs mt-1">Initializing 3D Digital Twin...</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className={`fade-in ${fullscreen ? 'fixed inset-0 z-50 bg-[#050a18] p-0' : 'space-y-4'}`}>
        {/* Header */}
        {!fullscreen && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/digital-twin')} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  {mine?.name || 'Loading...'}
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${isUnderground ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isUnderground ? 'Underground' : 'Open Cast'}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${mine?.status === 'normal' ? 'bg-green-400' : mine?.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
                </h1>
                <p className="text-[10px] text-slate-500 flex items-center gap-2">
                  {mine?.location} &middot; Depth: {mine?.depth_m}m &middot; Seam: {mine?.seam_thickness_m}m
                  {connected && <span className="inline-flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="text-center">
                    <div className={`text-lg font-bold ${status === 'running' ? 'text-green-400' : status === 'breakdown' ? 'text-red-400' : status === 'maintenance' ? 'text-blue-400' : 'text-slate-500'}`}>{count}</div>
                    <div className="text-[8px] text-slate-600 uppercase">{status}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setFullscreen(true)} className="p-2 rounded-lg hover:bg-white/5" title="Fullscreen"><Maximize2 className="w-4 h-4 text-slate-400" /></button>
            </div>
          </div>
        )}

        {/* Critical advisories banner */}
        {!fullscreen && criticalAdvisories.length > 0 && (
          <div className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/15 flex items-center gap-3">
            <Zap className="w-4 h-4 text-red-400" />
            <p className="text-[11px] text-red-400"><span className="font-bold">{criticalAdvisories.length} critical advisories</span> &mdash; {criticalAdvisories[0]?.root_cause}</p>
          </div>
        )}

        {/* Underground critical hazard banner */}
        {!fullscreen && isUnderground && criticalUgWarnings.length > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-red-950/40 border border-red-500/30 flex items-center gap-3" style={{ animation: 'warningPulse 2s ease-in-out infinite' }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-red-400 flex items-center gap-2">
                UNDERGROUND HAZARD — {criticalUgWarnings.length} Critical Warning{criticalUgWarnings.length > 1 ? 's' : ''}
                <span className="inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </p>
              <p className="text-[10px] text-red-300/70 mt-0.5 truncate">{criticalUgWarnings.map(w => w.message).join(' • ')}</p>
            </div>
            <button onClick={() => setSideTab('warnings')} className="text-[9px] px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-semibold whitespace-nowrap">
              View Details
            </button>
          </div>
        )}

        {/* Mine Production Metrics Strip */}
        {!fullscreen && mine && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Current Production', value: `${mine.current_production_tph.toFixed(2)}`, unit: 'TPH', color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
              { label: 'Daily Output', value: `${(mine.current_production_tph * 24 / 1000).toFixed(2)}`, unit: 'KT/day', color: 'text-green-400', bg: 'bg-green-500/8', border: 'border-green-500/20' },
              { label: 'Annual Capacity', value: `${mine.capacity_mtpa}`, unit: 'MTPA', color: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
              { label: 'Capacity Utilization', value: `${((mine.current_production_tph * 8760 / (mine.capacity_mtpa * 1e6)) * 100).toFixed(2)}`, unit: '%', color: 'text-purple-400', bg: 'bg-purple-500/8', border: 'border-purple-500/20' },
              { label: 'Coal Extracted', value: `${(mine.current_production_tph * new Date().getHours() / 1000).toFixed(2)}`, unit: 'KT today', color: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20' },
              { label: 'Active Equipment', value: `${equipment.filter(e => e.status === 'running').length}/${equipment.length}`, unit: 'units', color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
            ].map(m => (
              <div key={m.label} className={`${m.bg} border ${m.border} rounded-xl p-3`}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">{m.label}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-lg font-bold ${m.color}`}>{m.value}</span>
                  <span className="text-[10px] text-slate-500">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Grid */}
        <div className={`grid ${fullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'} gap-4`}>
          {/* 3D Canvas */}
          <div className={`${fullscreen ? 'h-screen' : 'lg:col-span-3'} glass-card overflow-hidden relative`} style={{ height: fullscreen ? '100vh' : 560 }}>
            {fullscreen && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                <button onClick={() => setFullscreen(false)} className="p-2 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur transition-colors"><Minimize2 className="w-4 h-4 text-white" /></button>
                <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg"><p className="text-xs font-bold text-white">{mine?.name}</p><p className="text-[9px] text-slate-400">{mine?.location} &middot; {isUnderground ? 'Underground' : 'Open Cast'}</p></div>
              </div>
            )}
            <Canvas shadows camera={{ position: isUnderground ? [80, 60, 80] : [200, 115, 200], fov: 50 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.8 }}>
              <Suspense fallback={null}>
                {isUnderground ? (
                  <UndergroundScene mine={mine!} equipmentList={equipment} onEquipmentClick={handleEquipmentClick} onInfraClick={handleInfraClick} config={config} />
                ) : (
                  <OpenPitScene mine={mine!} equipmentList={equipment} onEquipmentClick={handleEquipmentClick} onInfraClick={handleInfraClick} config={config} />
                )}
              </Suspense>
            </Canvas>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-3 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
              {[{ color: 'bg-amber-400', label: 'Running' }, { color: 'bg-red-400', label: 'Breakdown' }, { color: 'bg-blue-400', label: 'Maintenance' }, { color: 'bg-gray-400', label: 'Idle' }].map(l => (
                <div key={l.label} className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${l.color}`} /><span className="text-[9px] text-slate-400">{l.label}</span></div>
              ))}
            </div>

            {/* Mine physical details overlay */}
            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-4 py-3.5 rounded-xl border border-slate-700/30 w-[260px]">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUnderground ? 'bg-purple-500/15 border border-purple-500/20' : 'bg-amber-500/15 border border-amber-500/20'}`}>
                  <Mountain className={`w-4 h-4 ${isUnderground ? 'text-purple-400' : 'text-amber-400'}`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{isUnderground ? 'Underground Mine' : 'Open Cast Mine'}</p>
                  <p className="text-[10px] text-slate-500">{mine?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/[0.03] rounded-lg p-2 border border-slate-700/15">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">Depth</p>
                  <p className="text-sm font-bold text-white">{mine?.depth_m}<span className="text-[10px] text-slate-500 ml-0.5">m</span></p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2 border border-slate-700/15">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">Capacity</p>
                  <p className="text-sm font-bold text-amber-400">{mine?.capacity_mtpa}<span className="text-[10px] text-slate-500 ml-0.5">MTPA</span></p>
                </div>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Seam Thickness</span><span className="text-slate-300 font-medium">{mine?.seam_thickness_m}m</span></div>
                {!isUnderground && <div className="flex justify-between"><span className="text-slate-500">Strip Ratio</span><span className="text-slate-300 font-medium">{mine?.strip_ratio}:1</span></div>}
                {!isUnderground && <div className="flex justify-between"><span className="text-slate-500">Benches</span><span className="text-slate-300 font-medium">{mine?.bench_count}</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">Coal Type</span><span className="text-slate-300 font-medium">Grade D/E</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Equipment</span><span className="text-slate-300 font-medium">{equipment.length} units</span></div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-700/25">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Mine Health</span>
                  <span className="text-xs font-bold text-green-400">{(() => { const greens = kpiList.filter(k => k.status === 'green').length; return kpiList.length > 0 ? Math.round((greens / kpiList.length) * 100) : 0; })()}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${(() => { const greens = kpiList.filter(k => k.status === 'green').length; return kpiList.length > 0 ? Math.round((greens / kpiList.length) * 100) : 0; })()}%` }} />
                </div>
              </div>
            </div>

            {/* Infrastructure Detail Popup */}
            {infraData && (
              <>
                <div className="absolute inset-0 z-10" onClick={() => setSelectedInfra(null)} />
                <div className="absolute top-0 right-0 z-20 bg-[#080d1c]/[0.98] backdrop-blur-xl border-l border-slate-700/40 w-[340px] h-full shadow-2xl overflow-y-auto">
                  {/* Type Badge + Close */}
                  <div className="px-4 pt-4 pb-0 flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded uppercase tracking-widest ${
                      infraData.type === 'Power' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' :
                      infraData.type === 'Production' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      infraData.type === 'Safety' || infraData.type === 'Emergency' ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
                      infraData.type === 'Environmental' || infraData.type === 'Dewatering' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                      infraData.type === 'Logistics' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' :
                      'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}>{infraData.type}</span>
                    <button onClick={() => setSelectedInfra(null)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
                  </div>

                  {/* Name + ID */}
                  <div className="px-4 pt-2 pb-1">
                    <h3 className="text-lg font-bold text-white leading-tight">{infraData.name}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">SS-{String(selectedInfra || '').slice(-2).toUpperCase()} · {infraData.type === 'Power' ? '400kV' : infraData.type === 'Processing' ? 'CHP' : infraData.type === 'Access' ? `${mine?.depth_m}m` : 'Active'}</p>
                  </div>

                  {/* Status + Alert Count */}
                  <div className="px-4 py-2">
                    {(() => {
                      const isOk = ['Operational','Active','Online','Running','Ready','Normal','Loading','Active Cutting'].includes(infraData.status);
                      const unack = alerts.filter(a => !a.acknowledged).length;
                      return (
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${isOk ? 'text-amber-400' : 'text-red-400'}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${isOk ? 'bg-amber-400' : 'bg-red-400'} animate-pulse`} />
                            {isOk ? 'WARNING' : 'CRITICAL'}
                          </span>
                          <span className="text-[11px] text-red-400 font-medium">{unack > 0 ? `${unack} alert${unack > 1 ? 's' : ''}` : ''}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Key Metrics - 2x2 highlighted grid */}
                  <div className="px-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                      {infraData.metrics.slice(0, 4).map(m => (
                        <div key={m.label} className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/25">
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                          <p className={`text-xl font-bold mt-0.5 ${m.color === 'green' ? 'text-green-400' : m.color === 'amber' ? 'text-amber-400' : m.color === 'red' ? 'text-red-400' : 'text-white'}`}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Metrics Section - matching reference style */}
                  {infraData.metrics.length > 4 && (
                    <div className="mx-4 mt-2 rounded-lg border border-slate-700/30 overflow-hidden">
                      <div className="bg-slate-800/30 px-3 py-2 border-b border-slate-700/25">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{
                          infraData.type === 'Power' ? 'TRANSFORMER BANK' :
                          infraData.type === 'Processing' ? 'PROCESSING DETAILS' :
                          infraData.type === 'Production' ? 'PRODUCTION DETAILS' :
                          infraData.type === 'Safety' ? 'MONITORING SYSTEMS' :
                          infraData.type === 'Logistics' ? 'TRANSPORT DETAILS' :
                          infraData.type === 'Maintenance' ? 'WORKSHOP STATUS' :
                          infraData.type === 'Environmental' || infraData.type === 'Dewatering' ? 'TREATMENT DETAILS' :
                          'OPERATIONAL DETAILS'
                        }</h4>
                      </div>
                      <div className="divide-y divide-slate-700/20">
                        {infraData.metrics.slice(4).map(m => (
                          <div key={m.label} className="flex justify-between items-center px-3 py-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</span>
                            <span className={`text-[12px] font-bold ${m.color === 'green' ? 'text-green-400' : m.color === 'amber' ? 'text-amber-400' : m.color === 'red' ? 'text-red-400' : 'text-white'}`}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Protection & Control / Status Section */}
                  <div className="mx-4 mt-3 rounded-lg border border-slate-700/30 overflow-hidden">
                    <div className="bg-slate-800/30 px-3 py-2 border-b border-slate-700/25">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{
                        infraData.type === 'Power' ? 'PROTECTION & CONTROL' :
                        infraData.type === 'Safety' ? 'SAFETY PARAMETERS' :
                        'SYSTEM STATUS'
                      }</h4>
                    </div>
                    <div className="divide-y divide-slate-700/20">
                      {[
                        { label: infraData.type === 'Power' ? 'BUS PROTECTION' : 'PRIMARY SYSTEM', value: infraData.status === 'Online' || infraData.status === 'Operational' ? 'Active' : 'Standby' },
                        { label: infraData.type === 'Power' ? 'DIFFERENTIAL' : 'BACKUP SYSTEM', value: 'Normal' },
                        { label: infraData.type === 'Power' ? 'OVERCURRENT' : 'MONITORING', value: infraData.status === 'Ready' ? 'Pending' : 'Active' },
                        { label: infraData.type === 'Power' ? 'EARTH FAULT' : 'SAFETY INTERLOCK', value: 'Normal' },
                        { label: 'SCADA LINK', value: 'Connected' },
                        { label: 'LAST SCADA SYNC', value: '< 2 sec ago' },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center px-3 py-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{row.label}</span>
                          <span className={`text-[12px] font-bold ${row.value === 'Active' || row.value === 'Normal' || row.value === 'Connected' ? 'text-green-400' : row.value === 'Pending' ? 'text-amber-400' : 'text-white'}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Health Index */}
                  {(() => {
                    const healthVal = Math.floor(70 + (selectedInfra || '').charCodeAt(0) % 25);
                    return (
                      <div className="px-4 mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">Health Index</span>
                        <div className="flex items-center gap-2 flex-1 ml-3">
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${healthVal >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : healthVal >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`} style={{ width: `${healthVal}%` }} />
                          </div>
                          <span className={`text-sm font-bold ${healthVal >= 80 ? 'text-green-400' : healthVal >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{healthVal}%</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Load Factor / Utilization */}
                  {(() => {
                    const loadVal = Math.floor(65 + (selectedInfra || '').charCodeAt(1) % 25);
                    return (
                      <div className="px-4 mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">{infraData.type === 'Power' ? 'Load Factor' : 'Utilization'}</span>
                        <div className="flex items-center gap-2 flex-1 ml-3">
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${loadVal}%` }} />
                          </div>
                          <span className="text-sm font-bold text-blue-400">{loadVal}%</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Active Alerts Row */}
                  {(() => {
                    const unack = alerts.filter(a => !a.acknowledged).length;
                    return unack > 0 ? (
                      <div className="mx-4 mt-3 flex items-center justify-between p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px] text-amber-400 font-semibold">{unack} active alert{unack > 1 ? 's' : ''}</span>
                        </div>
                        <button className="text-[10px] text-amber-400 font-bold hover:text-amber-300 transition-colors">View</button>
                      </div>
                    ) : null;
                  })()}

                  {/* Description */}
                  <div className="px-4 mt-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed">{infraData.description}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="px-4 py-4 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-colors text-xs font-bold">
                        <Wrench className="w-3.5 h-3.5" />Work Order
                      </button>
                      <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors text-xs font-bold">
                        <Truck className="w-3.5 h-3.5" />Dispatch Crew
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const typeToRoute: Record<string, string> = {
                          'Processing': '/subsystems/mining', 'Production': '/subsystems/mining', 'Access': '/subsystems/mining',
                          'Power': '/subsystems/mining', 'Fuel': '/subsystems/finance', 'Weighing': '/subsystems/logistics',
                          'Storage': '/subsystems/logistics', 'Logistics': '/subsystems/logistics',
                          'Environmental': '/subsystems/esg', 'Dewatering': '/subsystems/esg',
                          'Safety': '/subsystems/ehs', 'Emergency': '/subsystems/ehs',
                          'Maintenance': '/subsystems/mining', 'Admin': '/subsystems/hr',
                          'Tunnel': '/subsystems/mining',
                        };
                        router.push(typeToRoute[infraData.type] || '/subsystems/mining');
                      }}
                      className="w-full mt-2.5 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-400 border border-cyan-500/25 hover:from-cyan-500/25 hover:to-blue-500/25 transition-all text-xs font-bold"
                    >
                      Open {infraData.type} Subsystem
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          </div>

          {/* Side Panel */}
          {!fullscreen && (
            <div className="space-y-3">
              <div className="glass-card p-1.5 flex gap-1">
                {(['kpis', 'equipment', 'alerts', ...(isUnderground ? ['warnings' as const] : [])] as const).map(tab => (
                  <button key={tab} onClick={() => setSideTab(tab)} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors capitalize ${sideTab === tab ? 'bg-amber-500/15 text-amber-400 shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}>
                    {tab === 'alerts' ? `Alerts (${activeAlerts.length})` : tab === 'warnings' ? `Warnings` : tab}
                  </button>
                ))}
              </div>

              {sideTab === 'kpis' && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live KPIs</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">{kpiList.filter(k => k.status === 'green').length}/{kpiList.length} healthy</span>
                  </div>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {kpiList.map(k => {
                      const Icon = KPI_ICON[k.name] || Activity;
                      return (
                        <div key={k.name} className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors border border-slate-700/15">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-slate-500" /><span className="text-[11px] text-slate-300 font-medium">{k.name}</span></div>
                            <div className={`w-2 h-2 rounded-full ${k.status === 'green' ? 'bg-green-400' : k.status === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-base font-bold ${k.status === 'green' ? 'text-green-400' : k.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{typeof k.value === 'number' ? k.value.toFixed(2) : k.value}</span>
                            <span className="text-[10px] text-slate-600">{k.unit}</span>
                          </div>
                          <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1">
                            <div className={`h-1 rounded-full transition-all ${k.status === 'green' ? 'bg-green-500' : k.status === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, typeof k.value === 'number' ? k.value : 50)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sideTab === 'equipment' && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Equipment</h3>
                    <span className="text-[10px] text-slate-500 font-medium">{equipment.length} units</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {Object.entries(statusCounts).map(([s, c]) => (
                      <div key={s} className={`text-center p-1.5 rounded-lg ${s === 'running' ? 'bg-green-500/8 border border-green-500/15' : s === 'breakdown' ? 'bg-red-500/8 border border-red-500/15' : s === 'maintenance' ? 'bg-blue-500/8 border border-blue-500/15' : 'bg-slate-800/50 border border-slate-700/15'}`}>
                        <p className={`text-sm font-bold ${s === 'running' ? 'text-green-400' : s === 'breakdown' ? 'text-red-400' : s === 'maintenance' ? 'text-blue-400' : 'text-slate-500'}`}>{c}</p>
                        <p className="text-[9px] text-slate-500 capitalize">{s}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                    {equipment.map(eq => (
                      <button key={eq.id} onClick={() => { setSelectedEq(eq); setSelectedInfra(null); }} className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all hover:bg-white/[0.06] ${selectedEq?.id === eq.id ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.03] border border-slate-700/15'}`}>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-300">{eq.name}</p>
                          <p className="text-[9px] text-slate-600 capitalize">{eq.type.replace('_',' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[11px] font-bold capitalize ${eq.status === 'running' ? 'text-green-400' : eq.status === 'breakdown' ? 'text-red-400' : eq.status === 'maintenance' ? 'text-blue-400' : 'text-slate-500'}`}>{eq.status}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-12 bg-slate-800 rounded-full h-1"><div className={`h-1 rounded-full ${eq.utilization > 85 ? 'bg-green-500' : eq.utilization > 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${eq.utilization}%` }} /></div>
                            <span className="text-[10px] text-slate-500 font-medium">{eq.utilization.toFixed(2)}%</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sideTab === 'alerts' && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Alerts</h3>
                    {activeAlerts.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">{activeAlerts.filter(a => a.severity === 'critical').length} critical</span>}
                  </div>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {activeAlerts.length === 0 && <p className="text-xs text-slate-600 text-center py-6">No active alerts</p>}
                    {activeAlerts.slice(0, 15).map(a => (
                      <div key={a.id} className={`p-3 rounded-xl ${a.severity === 'critical' ? 'bg-red-500/8 border border-red-500/20' : a.severity === 'warning' ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-blue-500/8 border border-blue-500/20'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${a.severity === 'critical' ? 'bg-red-500 animate-pulse' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          <span className={`text-[10px] font-bold uppercase ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{a.severity}</span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${a.severity === 'critical' ? 'text-red-300' : a.severity === 'warning' ? 'text-amber-300' : 'text-blue-300'}`}>{a.message}</p>
                        <p className="text-[9px] text-slate-600 mt-1">{new Date(a.timestamp).toLocaleTimeString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Underground warnings tab */}
              {sideTab === 'warnings' && isUnderground && (
                <div className="glass-card p-3 border-red-500/20">
                  <h3 className="text-[10px] font-semibold text-red-400 uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Underground Hazard Warnings
                  </h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">{UG_WARNINGS.filter(w => w.severity === 'critical').length} Critical</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">{UG_WARNINGS.filter(w => w.severity === 'warning').length} Warning</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">{UG_WARNINGS.filter(w => w.severity === 'info').length} Info</span>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {UG_WARNINGS.sort((a, b) => { const sev = { critical: 0, warning: 1, info: 2 }; return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3); }).map(w => {
                      const WarnIcon = WARNING_ICONS[w.type] || AlertTriangle;
                      const isCritical = w.severity === 'critical';
                      return (
                        <div key={w.id} className={`p-2.5 rounded-lg transition-all ${isCritical ? 'bg-red-500/10 border border-red-500/30 shadow-lg shadow-red-500/5' : w.severity === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/15'}`} style={isCritical ? { animation: 'warningPulse 3s ease-in-out infinite' } : undefined}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <WarnIcon className={`w-3.5 h-3.5 ${isCritical ? 'text-red-400' : w.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`} />
                            <span className={`text-[10px] font-bold ${isCritical ? 'text-red-400' : w.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{w.type.replace('_', ' ').toUpperCase()}</span>
                            {isCritical && <span className="ml-auto inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                            {w.value && <span className={`${isCritical ? '' : 'ml-auto'} text-[9px] font-bold text-slate-300`}>{w.value}</span>}
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed">{w.message}</p>
                          <p className="text-[8px] text-slate-600 mt-0.5">{w.location}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Equipment Detail */}
              {selectedEq && (
                <div className="glass-card p-4 border-amber-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-amber-400">{selectedEq.name}</h3>
                    <button onClick={() => setSelectedEq(null)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-3.5 h-3.5 text-slate-600" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white/[0.03] rounded-lg p-2 border border-slate-700/15">
                      <p className="text-[9px] text-slate-500 uppercase">Utilization</p>
                      <p className={`text-base font-bold ${selectedEq.utilization > 85 ? 'text-green-400' : selectedEq.utilization > 60 ? 'text-amber-400' : 'text-red-400'}`}>{selectedEq.utilization.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2 border border-slate-700/15">
                      <p className="text-[9px] text-slate-500 uppercase">Fuel Rate</p>
                      <p className="text-base font-bold text-white">{selectedEq.fuel_consumption.toFixed(2)}<span className="text-[10px] text-slate-500 ml-0.5">L/hr</span></p>
                    </div>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    {[['Type', selectedEq.type.replace('_', ' ')], ['Status', selectedEq.status], ['Hours Since Maint.', `${selectedEq.hours_since_maintenance.toFixed(2)}h`]].map(([label, val]) => (
                      <div key={label} className="flex justify-between"><span className="text-slate-500">{label}</span><span className={`font-semibold capitalize ${label === 'Status' ? (val === 'running' ? 'text-green-400' : val === 'breakdown' ? 'text-red-400' : 'text-blue-400') : 'text-slate-300'}`}>{val}</span></div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-slate-500">Utilization</span><span className="text-[10px] font-bold text-slate-300">{selectedEq.utilization.toFixed(2)}%</span></div>
                    <div className="w-full bg-slate-800 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${selectedEq.utilization > 85 ? 'bg-green-500' : selectedEq.utilization > 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selectedEq.utilization}%` }} /></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom KPI Charts */}
        {!fullscreen && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {['Production Rate', 'Equipment Utilization', 'Safety Score', 'Dispatch Efficiency'].map(kpiName => {
              const history = kpiHistory[kpiName] || [];
              const chartData = history.map((d: any) => ({ time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: d.value }));
              const k = kpis[kpiName]; const currentVal = (k && typeof k === 'object' && 'value' in k) ? k.value : null;
              const status = (k && typeof k === 'object' && 'status' in k) ? k.status : 'green';
              const Icon = KPI_ICON[kpiName] || Activity;
              return (
                <div key={kpiName} className="glass-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5"><Icon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-semibold text-white">{kpiName}</span></div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${status === 'green' ? 'bg-green-400' : status === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
                      {currentVal !== null && <span className={`text-xs font-bold ${status === 'green' ? 'text-green-400' : status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{currentVal.toFixed(2)}</span>}
                    </div>
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={80}>
                      <AreaChart data={chartData}>
                        <defs><linearGradient id={`g_${kpiName.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                        <Area type="monotone" dataKey="value" stroke="#f59e0b" fill={`url(#g_${kpiName.replace(/\s/g,'')})`} strokeWidth={1.5} dot={false} />
                        <YAxis hide domain={['auto','auto']} /><RTooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: 6, fontSize: 9 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (<div className="h-[80px] flex items-center justify-center"><Activity className="w-4 h-4 text-slate-700 animate-pulse" /></div>)}
                </div>
              );
            })}
          </div>
        )}

        {/* Operations Health Row */}
        {!fullscreen && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-white mb-3">Operations Health</h3>
              <ResponsiveContainer width="100%" height={180}><RadarChart data={radarData}><PolarGrid stroke="#1e2d52" /><PolarAngleAxis dataKey="metric" tick={{ fontSize: 8, fill: '#94a3b8' }} /><PolarRadiusAxis tick={{ fontSize: 7, fill: '#475569' }} domain={[0, 100]} /><Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} /></RadarChart></ResponsiveContainer>
            </div>
            <div className="glass-card p-4">
              <h3 className="text-xs font-semibold text-white mb-3">Equipment Status</h3>
              <ResponsiveContainer width="100%" height={140}><PieChart><Pie data={equipPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4} dataKey="value">{equipPieData.map((d,i) => <Cell key={i} fill={d.color} />)}</Pie><RTooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: 6, fontSize: 10 }} /></PieChart></ResponsiveContainer>
              <div className="flex justify-center gap-3 mt-1">{equipPieData.map(d => (<div key={d.name} className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} /><span className="text-[9px] text-slate-500">{d.name} ({d.value})</span></div>))}</div>
            </div>
            <div className="glass-card p-4 border-purple-500/15">
              <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-semibold text-white flex items-center gap-1.5"><Zap className="w-3 h-3 text-purple-400" />AI Advisories</h3><span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">{advisories.filter(a => a.status === 'active').length} active</span></div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {advisories.filter(a => a.status === 'active').slice(0, 4).map(adv => (
                  <div key={adv.id} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <div className="flex items-center gap-1.5 mb-0.5"><div className={`w-1.5 h-1.5 rounded-full ${adv.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} /><span className="text-[9px] text-slate-500 capitalize">{adv.kpi_category}</span>{adv.risk_score > 0 && <span className={`ml-auto text-[9px] font-bold ${adv.risk_score >= 80 ? 'text-red-400' : 'text-amber-400'}`}>{adv.risk_score}%</span>}</div>
                    <p className="text-[10px] text-slate-300 line-clamp-2">{adv.root_cause}</p>
                  </div>
                ))}
                {advisories.filter(a => a.status === 'active').length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No active advisories</p>}
              </div>
            </div>
          </div>
        )}

        {/* Equipment Fleet Grid */}
        {!fullscreen && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                Equipment Fleet &mdash; {equipment.length} Units
              </h3>
              <div className="flex gap-2">{Object.entries(statusCounts).map(([s, c]) => (<span key={s} className={`text-[9px] px-1.5 py-0.5 rounded ${s === 'running' ? 'bg-green-500/10 text-green-400' : s === 'breakdown' ? 'bg-red-500/10 text-red-400' : s === 'maintenance' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>{c} {s}</span>))}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {equipment.map(eq => {
                const EqIcon = eq.type === 'excavator' ? HardHat : eq.type === 'dump_truck' ? Truck : eq.type === 'conveyor' ? Layers : eq.type === 'drill' ? Gauge : Wrench;
                return (
                  <button key={eq.id} onClick={() => { setSelectedEq(eq); setSelectedInfra(null); }} className={`p-2.5 rounded-lg border text-center transition-all hover:scale-[1.03] ${eq.status === 'running' ? 'border-green-500/20 bg-green-500/5' : eq.status === 'breakdown' ? 'border-red-500/20 bg-red-500/5 animate-pulse' : eq.status === 'maintenance' ? 'border-blue-500/20 bg-blue-500/5' : 'border-slate-700 bg-slate-900/50'} ${selectedEq?.id === eq.id ? 'ring-1 ring-amber-400/50' : ''}`}>
                    <EqIcon className={`w-3.5 h-3.5 mx-auto mb-1 ${eq.status === 'running' ? 'text-green-400/60' : eq.status === 'breakdown' ? 'text-red-400/60' : eq.status === 'maintenance' ? 'text-blue-400/60' : 'text-slate-600'}`} />
                    <p className="text-[9px] font-medium text-slate-300 truncate">{eq.name}</p>
                    <p className={`text-[8px] mt-0.5 font-semibold capitalize ${eq.status === 'running' ? 'text-green-400' : eq.status === 'breakdown' ? 'text-red-400' : eq.status === 'maintenance' ? 'text-blue-400' : 'text-slate-500'}`}>{eq.status}</p>
                    <div className="mt-1 w-full bg-slate-800 rounded-full h-1">
                      <div className={`h-1 rounded-full transition-all ${eq.utilization > 85 ? 'bg-green-500' : eq.utilization > 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${eq.utilization}%` }} />
                    </div>
                    <p className="text-[8px] text-slate-500 mt-0.5">{eq.utilization.toFixed(2)}%</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
