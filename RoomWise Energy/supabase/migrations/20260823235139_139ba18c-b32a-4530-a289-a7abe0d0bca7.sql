CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  latitude double precision,
  longitude double precision,
  total_levels integer,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO anon, authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to properties" ON public.properties FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label text NOT NULL,
  floor_number integer NOT NULL DEFAULT 1,
  ceiling_height_m double precision NOT NULL DEFAULT 2.5,
  footprint_area_m2 double precision,
  source_file text,
  raw_scan_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to rooms" ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.room_facades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  compass_bearing_deg double precision NOT NULL,
  window_area_m2 double precision NOT NULL DEFAULT 0,
  wall_area_m2 double precision NOT NULL DEFAULT 0,
  wall_id text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_facades TO anon, authenticated;
GRANT ALL ON public.room_facades TO service_role;
ALTER TABLE public.room_facades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to room_facades" ON public.room_facades FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  check_in_at timestamptz,
  check_out_at timestamptz,
  hours_to_check_in double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO anon, authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to bookings" ON public.bookings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  recommended_setpoint double precision NOT NULL,
  recovery_minutes double precision NOT NULL,
  savings_estimate double precision NOT NULL,
  confidence_tier text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0,
  explanation_text text,
  detail_json jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO anon, authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to recommendations" ON public.recommendations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  hourly_json jsonb NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_cache TO anon, authenticated;
GRANT ALL ON public.weather_cache TO service_role;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to weather_cache" ON public.weather_cache FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.solar_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  facade_bearing_deg double precision NOT NULL,
  tilt_deg double precision NOT NULL DEFAULT 90,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  hourly_json jsonb NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solar_cache TO anon, authenticated;
GRANT ALL ON public.solar_cache TO service_role;
ALTER TABLE public.solar_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to solar_cache" ON public.solar_cache FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);