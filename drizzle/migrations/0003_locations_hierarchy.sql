ALTER TABLE public.locations ADD COLUMN parent_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX locations_parent_idx ON public.locations(parent_id);