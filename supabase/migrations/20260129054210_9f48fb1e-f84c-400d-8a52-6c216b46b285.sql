-- Add questions column to ticket_categories for pre-ticket questions
ALTER TABLE public.ticket_categories 
ADD COLUMN questions jsonb DEFAULT '[]'::jsonb;

-- Add a comment to explain the structure
COMMENT ON COLUMN public.ticket_categories.questions IS 'Array of question objects: [{label: string, placeholder: string, required: boolean, style: "short" | "paragraph"}]';