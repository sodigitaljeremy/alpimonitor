import type { DataSource, FlowType, Parameter, SourcingStatus } from './common.js';

export type StationStatus = 'NORMAL' | 'VIGILANCE' | 'ALERT' | 'OFFLINE';

export interface StationLatestMeasurement {
  parameter: Parameter;
  unit: string;
  value: number;
  recordedAt: string;
  status: StationStatus;
}

export interface StationDTO {
  id: string;
  ofevCode: string;
  name: string;
  riverName: string;
  latitude: number;
  longitude: number;
  altitudeM: number;
  flowType: FlowType;
  operatorName: string;
  dataSource: DataSource;
  sourcingStatus: SourcingStatus;
  latestMeasurements: StationLatestMeasurement[];
  activeAlertsCount: number;
}

export type MeasurementAggregate = 'raw' | 'hourly' | 'daily';

export interface MeasurementPoint {
  t: string;
  v: number;
}

export interface MeasurementSeries {
  parameter: Parameter;
  unit: string;
  points: MeasurementPoint[];
}

export interface StationMeasurementsDTO {
  stationId: string;
  from: string;
  to: string;
  aggregate: MeasurementAggregate;
  series: MeasurementSeries[];
}
