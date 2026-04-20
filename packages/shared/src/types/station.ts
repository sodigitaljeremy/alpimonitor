import type { FlowType, Parameter } from './common.js';

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
  latestMeasurements: StationLatestMeasurement[];
  activeAlertsCount: number;
}
