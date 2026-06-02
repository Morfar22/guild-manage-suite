import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { GuildProvider } from "@/contexts/GuildContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly loaded pages (initial routes)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GuildSelect from "./pages/GuildSelect";
import NotFound from "./pages/NotFound";

// Lazy loaded pages (loaded on-demand)
const Docs = lazy(() => import("./pages/Docs"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const DocsLayout = lazy(() => import("./components/docs/DocsLayout").then(m => ({ default: m.DocsLayout })));
const Admin = lazy(() => import("./pages/Admin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Modules = lazy(() => import("./pages/Modules"));
const Moderation = lazy(() => import("./pages/Moderation"));
const Commands = lazy(() => import("./pages/Commands"));
const Logs = lazy(() => import("./pages/Logs"));
const LogSettings = lazy(() => import("./pages/LogSettings"));
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const TicketSettings = lazy(() => import("./pages/TicketSettings"));
const ApplicationList = lazy(() => import("./pages/ApplicationList"));
const ApplicationSettings = lazy(() => import("./pages/ApplicationSettings"));
const ApplicationFormEdit = lazy(() => import("./pages/ApplicationFormEdit"));
const ApplicationReview = lazy(() => import("./pages/ApplicationReview"));
const ApplicationAnalytics = lazy(() => import("./pages/ApplicationAnalytics"));
const Characters = lazy(() => import("./pages/Characters"));
const Members = lazy(() => import("./pages/Members"));
const WelcomeSettings = lazy(() => import("./pages/WelcomeSettings"));
const InviteTracker = lazy(() => import("./pages/InviteTracker"));
const Leveling = lazy(() => import("./pages/Leveling"));
const ReactionRoles = lazy(() => import("./pages/ReactionRoles"));
const AutoModeration = lazy(() => import("./pages/AutoModeration"));
const Economy = lazy(() => import("./pages/Economy"));
const Giveaways = lazy(() => import("./pages/Giveaways"));
const TwitchSettings = lazy(() => import("./pages/TwitchSettings"));
const TikTokSettings = lazy(() => import("./pages/TikTokSettings"));
const YouTubeSettings = lazy(() => import("./pages/YouTubeSettings"));
const JTCSettings = lazy(() => import("./pages/JTCSettings"));
const AIChatSettings = lazy(() => import("./pages/AIChatSettings"));
const ServerClone = lazy(() => import("./pages/ServerClone"));
const Features = lazy(() => import("./pages/Features"));
const FiveMSettings = lazy(() => import("./pages/FiveMSettings"));
const BotSettings = lazy(() => import("./pages/BotSettings"));
const StarboardSettings = lazy(() => import("./pages/StarboardSettings"));
const SchedulerSettings = lazy(() => import("./pages/SchedulerSettings"));
const ModmailSettings = lazy(() => import("./pages/ModmailSettings"));
const WarningsSettings = lazy(() => import("./pages/WarningsSettings"));
const TebexSettings = lazy(() => import("./pages/TebexSettings"));
const EmbedBuilder = lazy(() => import("./pages/EmbedBuilder"));
const SuggestionSettings = lazy(() => import("./pages/SuggestionSettings"));
const VerificationSettings = lazy(() => import("./pages/VerificationSettings"));
const BackupSettings = lazy(() => import("./pages/BackupSettings"));
const StatsChannels = lazy(() => import("./pages/StatsChannels"));
const GlobalBanReports = lazy(() => import("./pages/GlobalBanReports"));
const ScheduledActions = lazy(() => import("./pages/ScheduledActions"));
const Polls = lazy(() => import("./pages/Polls"));
const AutoResponders = lazy(() => import("./pages/AutoResponders"));
const CustomCommands = lazy(() => import("./pages/CustomCommands"));
const RealtimeEventDashboard = lazy(() => import("./pages/RealtimeEventDashboard"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const BotTestPanel = lazy(() => import("./pages/BotTestPanel"));
const BotHealth = lazy(() => import("./pages/BotHealth"));
const Reminders = lazy(() => import("./pages/Reminders"));
const DashboardChangelog = lazy(() => import("./pages/DashboardChangelog"));
const AutoReports = lazy(() => import("./pages/AutoReports"));
const AIAutomodSettings = lazy(() => import("./pages/AIAutomodSettings"));
const RoleAnalytics = lazy(() => import("./pages/RoleAnalytics"));
const MemberActivityHeatmap = lazy(() => import("./pages/MemberActivityHeatmap"));
const DashboardNotifications = lazy(() => import("./pages/DashboardNotifications"));
const WebhookManager = lazy(() => import("./pages/WebhookManager"));
const RaidProtection = lazy(() => import("./pages/RaidProtection"));
const SlowmodeScheduler = lazy(() => import("./pages/SlowmodeScheduler"));
const QuarantineSystem = lazy(() => import("./pages/QuarantineSystem"));
const CountingChannel = lazy(() => import("./pages/CountingChannel"));
const ConfessionSystem = lazy(() => import("./pages/ConfessionSystem"));
const BirthdayTracker = lazy(() => import("./pages/BirthdayTracker"));
const MusicQuizSettings = lazy(() => import("./pages/MusicQuizSettings"));
const CurrencyShop = lazy(() => import("./pages/CurrencyShop"));

const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout").then(m => ({ default: m.DashboardLayout })));

const queryClient = new QueryClient();

// Loading fallback for lazy components
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GuildProvider>
            <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <main className="min-h-screen">
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/docs" element={<DocsLayout />}>
                      <Route index element={<Docs />} />
                      <Route path=":category/:slug" element={<DocsPage />} />
                    </Route>
                    <Route path="/guilds" element={<GuildSelect />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/admin/global-bans" element={<GlobalBanReports />} />
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="modules" element={<Modules />} />
                      <Route path="moderation" element={<Moderation />} />
                      <Route path="warnings" element={<WarningsSettings />} />
                      <Route path="commands" element={<Commands />} />
                      <Route path="logs" element={<Logs />} />
                      <Route path="log-settings" element={<LogSettings />} />
                      <Route path="tickets" element={<Tickets />} />
                      <Route path="tickets/:ticketId" element={<TicketDetail />} />
                      <Route path="tickets/settings" element={<TicketSettings />} />
                      <Route path="applications" element={<ApplicationList />} />
                     <Route path="applications/settings" element={<ApplicationSettings />} />
                     <Route path="applications/analytics" element={<ApplicationAnalytics />} />
                     <Route path="applications/forms/:formId" element={<ApplicationFormEdit />} />
                     <Route path="applications/:submissionId" element={<ApplicationReview />} />
                      <Route path="members" element={<Members />} />
                      <Route path="characters" element={<Characters />} />
                      <Route path="welcome" element={<WelcomeSettings />} />
                      <Route path="invite-tracker" element={<InviteTracker />} />
                      <Route path="leveling" element={<Leveling />} />
                      <Route path="reaction-roles" element={<ReactionRoles />} />
                      <Route path="automod" element={<AutoModeration />} />
                      <Route path="ai-automod" element={<AIAutomodSettings />} />
                      <Route path="economy" element={<Economy />} />
                      <Route path="giveaways" element={<Giveaways />} />
                      <Route path="starboard" element={<StarboardSettings />} />
                      <Route path="scheduler" element={<SchedulerSettings />} />
                      <Route path="modmail" element={<ModmailSettings />} />
                      <Route path="twitch" element={<TwitchSettings />} />
                      <Route path="tiktok" element={<TikTokSettings />} />
                      <Route path="youtube" element={<YouTubeSettings />} />
                      <Route path="jtc" element={<JTCSettings />} />
                      <Route path="ai-chat" element={<AIChatSettings />} />
                      <Route path="server-clone" element={<ServerClone />} />
                      <Route path="features" element={<Features />} />
                      <Route path="fivem" element={<FiveMSettings />} />
                      <Route path="tebex" element={<TebexSettings />} />
                      <Route path="bot-settings" element={<BotSettings />} />
                      <Route path="embed-builder" element={<EmbedBuilder />} />
                      <Route path="suggestions" element={<SuggestionSettings />} />
                      <Route path="verification" element={<VerificationSettings />} />
                      <Route path="backups" element={<BackupSettings />} />
                      <Route path="stats-channels" element={<StatsChannels />} />
                      <Route path="global-bans" element={<GlobalBanReports />} />
                      <Route path="scheduled-actions" element={<ScheduledActions />} />
                      <Route path="polls" element={<Polls />} />
                      <Route path="auto-responders" element={<AutoResponders />} />
                      <Route path="custom-commands" element={<CustomCommands />} />
                      <Route path="live-events" element={<RealtimeEventDashboard />} />
                      <Route path="leaderboard" element={<Leaderboard />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="test-panel" element={<BotTestPanel />} />
                      <Route path="bot-health" element={<BotHealth />} />
                      <Route path="reminders" element={<Reminders />} />
                      <Route path="changelog" element={<DashboardChangelog />} />
                      <Route path="auto-reports" element={<AutoReports />} />
                      <Route path="role-analytics" element={<RoleAnalytics />} />
                      <Route path="activity-heatmap" element={<MemberActivityHeatmap />} />
                      <Route path="notifications" element={<DashboardNotifications />} />
                      <Route path="webhooks" element={<WebhookManager />} />
                      <Route path="raid-protection" element={<RaidProtection />} />
                      <Route path="slowmode-scheduler" element={<SlowmodeScheduler />} />
                      <Route path="quarantine" element={<QuarantineSystem />} />
                      <Route path="counting" element={<CountingChannel />} />
                      <Route path="confessions" element={<ConfessionSystem />} />
                      <Route path="birthdays" element={<BirthdayTracker />} />
                      <Route path="music-quiz" element={<MusicQuizSettings />} />
                      <Route path="currency-shop" element={<CurrencyShop />} />
                      
                    </Route>
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
              </BrowserRouter>
            </TooltipProvider>
            </LanguageProvider>
          </GuildProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
