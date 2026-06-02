-- Create a table to store pending admin emails that should be promoted on first login
CREATE TABLE IF NOT EXISTS public.pending_admin_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false
);

-- Insert the email that should get admin access
INSERT INTO public.pending_admin_emails (email) 
VALUES ('emilj309@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Enable RLS (only accessible via service role)
ALTER TABLE public.pending_admin_emails ENABLE ROW LEVEL SECURITY;

-- No policies = only service role can access (secure)