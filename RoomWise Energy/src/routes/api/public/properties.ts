// GET /api/public/properties -> list of properties the scanner app can pick from.
// Use `slug` (or the exact `name`) as `propertySlug` / `propertyName` when POSTing a scan.

import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/properties")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("properties")
          .select("slug, name, latitude, longitude, total_levels, rooms(id)")
          .order("name");

        if (error) {
          return new Response(JSON.stringify({ error: "Failed to list properties." }), {
            status: 500,
            headers: { "content-type": "application/json", ...CORS },
          });
        }

        const properties = (data ?? []).map((p) => ({
          slug: p.slug,
          name: p.name,
          lat: p.latitude,
          long: p.longitude,
          totalLevels: p.total_levels,
          roomCount: Array.isArray(p.rooms) ? p.rooms.length : 0,
        }));

        return new Response(JSON.stringify({ properties }, null, 2), {
          headers: { "content-type": "application/json", ...CORS },
        });
      },
    },
  },
});
