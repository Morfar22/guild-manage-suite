-- Add new module types to the enum
ALTER TYPE public.module_type ADD VALUE IF NOT EXISTS 'economy';
ALTER TYPE public.module_type ADD VALUE IF NOT EXISTS 'tickets';
ALTER TYPE public.module_type ADD VALUE IF NOT EXISTS 'giveaway';