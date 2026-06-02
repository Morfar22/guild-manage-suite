-- Create IP whitelist table for admin access
CREATE TABLE public.admin_ip_whitelist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address text NOT NULL,
    description text,
    added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (ip_address)
);

-- Enable RLS
ALTER TABLE public.admin_ip_whitelist ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage IP whitelist
CREATE POLICY "Admins can view IP whitelist"
ON public.admin_ip_whitelist
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert IP whitelist"
ON public.admin_ip_whitelist
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update IP whitelist"
ON public.admin_ip_whitelist
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete IP whitelist"
ON public.admin_ip_whitelist
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_admin_ip_whitelist_updated_at
BEFORE UPDATE ON public.admin_ip_whitelist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();