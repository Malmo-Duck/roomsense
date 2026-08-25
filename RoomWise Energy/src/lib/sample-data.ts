// Seed portfolio + a sample LiDAR Record JSON for the upload flow.

import type { RoomRecord, RoomScanRecord } from "./types";
import { computeSetback } from "./thermal";

function room(
  partial: Omit<RoomRecord, "result" | "createdAt">,
  createdAt: string,
): RoomRecord {
  const { facades, ceilingHeight, floorNumber, totalLevels, lat, long } = partial;
  const result = computeSetback({
    facades,
    ceilingHeight,
    floorNumber,
    totalLevels,
    lat,
    long,
  });
  return { ...partial, result, createdAt };
}

export const SEED_ROOMS: RoomRecord[] = [
  room(
    {
      id: "rm-402",
      propertyId: "grand-plaza-resort",
      propertyName: "Grand Plaza Resort",
      label: "Room 402 (Exec)",
      floorNumber: 4,
      totalLevels: 12,
      lat: 40.7128,
      long: -74.006,
      ceilingHeight: 2.85,
      facades: [
        { id: "F1", orientation: "N", area: 14.2, glazingArea: 5.96, uValue: 0.28 },
        { id: "F2", orientation: "E", area: 28.5, glazingArea: 19.4, uValue: 0.3 },
        { id: "F3", orientation: "internal", area: 0, glazingArea: 0, uValue: 0 },
        { id: "F4", orientation: "internal", area: 0, glazingArea: 0, uValue: 0 },
      ],
      sourceFile: "record_402_LIDAR.json",
    },
    "2026-08-20T09:12:00Z",
  ),
  room(
    {
      id: "rm-404",
      propertyId: "grand-plaza-resort",
      propertyName: "Grand Plaza Resort",
      label: "Room 404 (Standard)",
      floorNumber: 4,
      totalLevels: 12,
      lat: 40.7128,
      long: -74.006,
      ceilingHeight: 2.7,
      facades: [
        { id: "F1", orientation: "N", area: 12.1, glazingArea: 3.0, uValue: 0.28 },
        { id: "F2", orientation: "W", area: 18.4, glazingArea: 1.8, uValue: 0.3 },
      ],
      sourceFile: "record_404_LIDAR.json",
    },
    "2026-08-20T09:30:00Z",
  ),
  room(
    {
      id: "rm-1204",
      propertyId: "grand-plaza-resort",
      propertyName: "Grand Plaza Resort",
      label: "Room 1204 (Penthouse)",
      floorNumber: 12,
      totalLevels: 12,
      lat: 40.7128,
      long: -74.006,
      ceilingHeight: 3.1,
      facades: [
        { id: "F1", orientation: "S", area: 16.0, glazingArea: 11.2, uValue: 0.26 },
        { id: "F2", orientation: "E", area: 22.2, glazingArea: 9.4, uValue: 0.3 },
        { id: "F3", orientation: "internal", area: 0, glazingArea: 0, uValue: 0 },
      ],
      sourceFile: "record_1204_LIDAR.json",
    },
    "2026-08-21T14:02:00Z",
  ),
  room(
    {
      id: "rm-101",
      propertyId: "urban-stay-suites",
      propertyName: "Urban Stay Suites",
      label: "Room 101 (Deluxe)",
      floorNumber: 1,
      totalLevels: 8,
      lat: 51.5074,
      long: -0.1278,
      ceilingHeight: 2.6,
      facades: [
        { id: "F1", orientation: "S", area: 13.5, glazingArea: 6.8, uValue: 0.32 },
        { id: "F2", orientation: "E", area: 9.2, glazingArea: 2.1, uValue: 0.34 },
      ],
      sourceFile: "record_101_LIDAR.json",
    },
    "2026-08-22T11:20:00Z",
  ),
  room(
    {
      id: "rm-305",
      propertyId: "urban-stay-suites",
      propertyName: "Urban Stay Suites",
      label: "Room 305 (Standard)",
      floorNumber: 3,
      totalLevels: 8,
      lat: 51.5074,
      long: -0.1278,
      ceilingHeight: 2.6,
      facades: [
        { id: "F1", orientation: "N", area: 11.0, glazingArea: 2.4, uValue: 0.32 },
        { id: "F2", orientation: "W", area: 14.8, glazingArea: 1.2, uValue: 0.34 },
      ],
      sourceFile: "record_305_LIDAR.json",
    },
    "2026-08-22T11:45:00Z",
  ),
];

/** A representative LiDAR Record JSON the upload flow can ingest. */
export const SAMPLE_SCAN_RECORD: RoomScanRecord = {
  recordId: "RM_410_SCAN",
  ceilingHeight: 2.75,
  gps: { lat: 40.713, long: -74.004 },
  facades: [
    { id: "F1", orientation: "S", area: 15.6, glazingArea: 8.4, uValue: 0.27 },
    { id: "F2", orientation: "E", area: 20.1, glazingArea: 6.2, uValue: 0.29 },
    { id: "F3", orientation: "internal", area: 0, glazingArea: 0, uValue: 0 },
    { id: "F4", orientation: "internal", area: 0, glazingArea: 0, uValue: 0 },
  ],
};

export const SAMPLE_SCAN_JSON = JSON.stringify(SAMPLE_SCAN_RECORD, null, 2);
