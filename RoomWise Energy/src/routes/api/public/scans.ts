// REST ingest endpoint for LiDAR scans.
//   POST /api/public/scans   -> parse a Record, store the room, return the setback result
//   GET  /api/public/scans   -> tiny usage doc
// Demo prototype: open endpoint, no auth.

import { createFileRoute } from "@tanstack/react-router";
import { parseRecord } from "@/lib/scan-parse";
import { computeSetback } from "@/lib/thermal";
import type { Facade } from "@/lib/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

const BEARINGS: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  internal: -1,
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const USAGE = {
  endpoint: "/api/public/scans",
  method: "POST",
  contentType: "application/json",
  body: {
    record: "LiDAR Record JSON (Skanza Record, or { recordId, ceilingHeight, facades[] })",
    propertySlug: "string, existing property from GET /api/public/properties",
    propertyName: "string, required only when creating a new property",
    label: "string, room name (optional, defaults from recordId)",
    floorNumber: "number (optional, default 1)",
    totalLevels: "number (optional, inherited from property)",
    lat: "number (optional, inherited from property, then record gps)",
    long: "number (optional, inherited from property, then record gps)",
    sourceFile: "string (optional)",
  },
  properties: "GET /api/public/properties",

  example:
    'curl -X POST <base>/api/public/scans -H "content-type: application/json" -d \'{"propertyName":"Grand Plaza Resort","label":"Room 410","floorNumber":4,"totalLevels":12,"record":{"recordId":"RM_410_SCAN","ceilingHeight":2.75,"gps":{"lat":40.713,"long":-74.004},"facades":[{"id":"F1","orientation":"S","area":15.6,"glazingArea":8.4,"uValue":0.27}]}}\'',
};

export const Route = createFileRoute("/api/public/scans")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => json(USAGE),
      POST: async ({ request }) => {
        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Body must be valid JSON." }, 400);
        }

        // Accept either { record: {...}, ...meta } or a bare Record with meta fields inline.
        const rawRecord = (payload["record"] ?? payload["scan"] ?? payload) as unknown;

        let scan;
        try {
          scan = parseRecord(rawRecord);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Parse failed." }, 422);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Property is keyed by slug: pass propertySlug (from /api/public/properties)
        // or propertyName (slugified). Existing properties supply lat/long/levels.
        const rawSlug = String(payload["propertySlug"] ?? "").trim();
        const rawName = String(payload["propertyName"] ?? "").trim();
        if (!rawSlug && !rawName)
          return json({ error: "propertySlug or propertyName is required." }, 400);
        const slug = rawSlug ? slugify(rawSlug) : slugify(rawName);

        const { data: existing } = await supabaseAdmin
          .from("properties")
          .select("id, name, latitude, longitude, total_levels")
          .eq("slug", slug)
          .maybeSingle();

        if (!existing && !rawName)
          return json(
            { error: `Unknown propertySlug "${slug}". Send propertyName to create it.` },
            404,
          );

        const propertyName = rawName || existing?.name || slug;
        const label =
          String(payload["label"] ?? "").trim() ||
          `Room ${scan.recordId.replace(/[^0-9]/g, "") || "scan"}`;
        const floorNumber = Number(payload["floorNumber"] ?? scan.floorNumber ?? 1);
        const totalLevels = Number(payload["totalLevels"] ?? existing?.total_levels ?? 8);
        const lat = Number(payload["lat"] ?? existing?.latitude ?? scan.gps?.lat ?? 59.33);
        const long = Number(payload["long"] ?? existing?.longitude ?? scan.gps?.long ?? 18.06);
        const sourceFile = payload["sourceFile"] ? String(payload["sourceFile"]) : null;

        const result = computeSetback({
          facades: scan.facades,
          ceilingHeight: scan.ceilingHeight,
          floorNumber,
          totalLevels,
          lat,
          long,
        });

        const { data: property, error: propErr } = await supabaseAdmin
          .from("properties")
          .upsert(
            {
              slug,
              name: propertyName,
              latitude: lat,
              longitude: long,
              total_levels: totalLevels,
            },
            { onConflict: "slug" },
          )
          .select("id")
          .single();
        if (propErr || !property) return json({ error: "Failed to store property." }, 500);

        const { data: room, error: roomErr } = await supabaseAdmin
          .from("rooms")
          .insert({
            property_id: property.id,
            label,
            floor_number: floorNumber,
            ceiling_height_m: scan.ceilingHeight,
            footprint_area_m2: result.footprint,
            source_file: sourceFile,
            raw_scan_json: scan as unknown as never,
          })
          .select("id, created_at")
          .single();
        if (roomErr || !room) return json({ error: "Failed to store room." }, 500);

        await supabaseAdmin.from("room_facades").insert(
          scan.facades.map((f: Facade) => ({
            room_id: room.id,
            compass_bearing_deg: BEARINGS[f.orientation] ?? -1,
            window_area_m2: f.glazingArea,
            wall_area_m2: f.area,
            wall_id: f.id,
          })),
        );

        await supabaseAdmin.from("recommendations").insert({
          room_id: room.id,
          recommended_setpoint: result.setbackC,
          recovery_minutes: result.uaTotal > 0 ? 90 : 60,
          savings_estimate: Math.round(result.uaTotal * 0.9),
          confidence_tier:
            result.confidence >= 0.8 ? "tier1" : result.confidence >= 0.6 ? "tier2" : "tier3",
          confidence: result.confidence,
          explanation_text: result.notes.join(" "),
          detail_json: { facades: scan.facades, result } as unknown as never,
        });

        return json(
          {
            roomId: room.id,
            url: `/rooms/${room.id}`,
            label,
            propertyName,
            createdAt: room.created_at,
            facades: scan.facades,
            result,
          },
          201,
        );
      },
    },
  },
});
