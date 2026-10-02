import { createFileRoute } from '@tanstack/react-router';
import PublicFeatures from '@/pages/PublicFeatures';

export const Route = createFileRoute('/features')({ component: PublicFeatures });
