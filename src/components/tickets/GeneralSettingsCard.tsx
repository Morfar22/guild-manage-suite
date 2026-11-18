import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChannelSelect } from "@/components/ui/channel-select";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";
import {
  useTicketSettings,
  useUpsertTicketSettings,
} from "@/hooks/useTicketSettings";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Star, FileText, X } from "lucide-react";

export default function GeneralSettingsCard() {
  const { data: settings } = useTicketSettings();
  const upsert = useUpsertTicketSettings();
  const { toast } = useToast();
  const { data: discordRoles = [] } = useDiscordRoles();

  const [threadCategoryId, setThreadCategoryId] = useState("");
  const [ticketChannelMode, setTicketChannelMode] = useState<
    "thread" | "channel"
  >("thread");
  const [transcriptChannelId, setTranscriptChannelId] = useState("");
  const [enableRatings, setEnableRatings] = useState(false);
  const [enableTranscripts, setEnableTranscripts] = useState(true);
  const [dmTranscript, setDmTranscript] = useState(true);
  const [ratingsPrompt, setRatingsPrompt] = useState("");
  const [rolePingWarningRoleIds, setRolePingWarningRoleIds] = useState<string[]>(
    [],
  );
  const [userPingWarningUserIds, setUserPingWarningUserIds] = useState<string[]>(
    [],
  );
  const [discordUserIdInput, setDiscordUserIdInput] = useState("");

  useEffect(() => {
    if (!settings) return;
    setThreadCategoryId(settings.thread_category_id || "");
    setTicketChannelMode(settings.ticket_channel_mode || "thread");
    setTranscriptChannelId(settings.transcript_channel_id || "");
    setEnableRatings(!!settings.enable_ratings);
    setEnableTranscripts(settings.enable_transcripts !== false);
    setDmTranscript(settings.dm_transcript_to_user !== false);
    setRatingsPrompt(settings.ratings_dm_prompt || "");
    setRolePingWarningRoleIds(settings.role_ping_warning_role_ids || []);
    setUserPingWarningUserIds(settings.user_ping_warning_user_ids || []);
  }, [settings]);

  const save = async () => {
    try {
      await upsert.mutateAsync({
        thread_category_id: threadCategoryId || null,
        ticket_channel_mode: ticketChannelMode,
        transcript_channel_id: transcriptChannelId || null,
        enable_ratings: enableRatings,
        enable_transcripts: enableTranscripts,
        dm_transcript_to_user: dmTranscript,
        ratings_dm_prompt: ratingsPrompt || null,
        role_ping_warning_role_ids: rolePingWarningRoleIds,
        user_ping_warning_user_ids: userPingWarningUserIds,
      });
      toast({ title: "Saved" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const addDiscordUserId = () => {
    const discordUserId = discordUserIdInput.trim();
    if (!/^\d{17,20}$/.test(discordUserId)) {
      toast({
        title: "Enter a valid Discord user ID",
        variant: "destructive",
      });
      return;
    }
    setUserPingWarningUserIds((userIds) =>
      userIds.includes(discordUserId) ? userIds : [...userIds, discordUserId],
    );
    setDiscordUserIdInput("");
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" /> General settings
        </CardTitle>
        <CardDescription>Server-wide ticket behaviour</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Ticket type</Label>
            <Select
              value={ticketChannelMode}
              onValueChange={(value: "thread" | "channel") =>
                setTicketChannelMode(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thread">Private thread</SelectItem>
                <SelectItem value="channel">Private channel</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose how new tickets are created.
            </p>
          </div>
          <div className="space-y-2">
            <Label>
              {ticketChannelMode === "thread"
                ? "Ticket parent channel"
                : "Ticket category"}
            </Label>
            <ChannelSelect
              value={threadCategoryId}
              onValueChange={setThreadCategoryId}
              placeholder={
                ticketChannelMode === "thread"
                  ? "Text channel for private ticket threads"
                  : "Category for private ticket channels"
              }
              includeCategories={ticketChannelMode === "channel"}
              allowedTypes={ticketChannelMode === "thread" ? [0] : undefined}
              showChannels={ticketChannelMode === "thread"}
            />
            <p className="text-xs text-muted-foreground">
              {ticketChannelMode === "thread"
                ? "Private ticket threads are created inside this Discord text channel."
                : "Private ticket channels are created inside this Discord category."}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Transcript log channel
            </Label>
            <ChannelSelect
              value={transcriptChannelId}
              onValueChange={setTranscriptChannelId}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" /> Transcripts
          </div>
          <ToggleRow
            label="Generate HTML transcripts on close"
            checked={enableTranscripts}
            onChange={setEnableTranscripts}
          />
          <ToggleRow
            label="DM transcript link to ticket creator"
            checked={dmTranscript}
            onChange={setDmTranscript}
            disabled={!enableTranscripts}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-border/40 p-4">
          <div>
            <p className="text-sm font-medium">Role-ping warning</p>
            <p className="text-xs text-muted-foreground">
              A warning is posted when one of these roles or users is tagged.
              The rule applies to everyone, including staff and admins.
            </p>
          </div>
          <div className="flex min-h-8 flex-wrap gap-2">
            {rolePingWarningRoleIds.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No roles selected.
              </span>
            ) : (
              rolePingWarningRoleIds.map((roleId) => {
                const role = discordRoles.find((item) => item.id === roleId);
                return (
                  <Badge key={roleId} variant="secondary" className="gap-1">
                    {role?.name || roleId}
                    <button
                      type="button"
                      aria-label="Remove role"
                      onClick={() =>
                        setRolePingWarningRoleIds((roleIds) =>
                          roleIds.filter((id) => id !== roleId),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })
            )}
          </div>
          <Select
            value=""
            onValueChange={(roleId) =>
              setRolePingWarningRoleIds((roleIds) =>
                roleIds.includes(roleId) ? roleIds : [...roleIds, roleId],
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Add role" />
            </SelectTrigger>
            <SelectContent>
              {discordRoles
                .filter(
                  (role) =>
                    role.name !== "@everyone" &&
                    !rolePingWarningRoleIds.includes(role.id),
                )
                .map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label className="text-xs">Discord user IDs</Label>
            <div className="flex min-h-8 flex-wrap gap-2">
              {userPingWarningUserIds.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No users selected.
                </span>
              ) : (
                userPingWarningUserIds.map((userId) => (
                  <Badge key={userId} variant="secondary" className="gap-1">
                    {userId}
                    <button
                      type="button"
                      aria-label="Remove user"
                      onClick={() =>
                        setUserPingWarningUserIds((userIds) =>
                          userIds.filter((id) => id !== userId),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={discordUserIdInput}
                onChange={(event) => setDiscordUserIdInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDiscordUserId();
                  }
                }}
                inputMode="numeric"
                placeholder="Discord user ID"
              />
              <Button type="button" variant="outline" onClick={addDiscordUserId}>
                Add user
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Star className="h-4 w-4" /> Post-ticket ratings
          </div>
          <ToggleRow
            label="Ask user to rate 1–5 stars after close"
            checked={enableRatings}
            onChange={setEnableRatings}
          />
          {enableRatings && (
            <div className="space-y-2">
              <Label className="text-xs">Rating DM prompt</Label>
              <Textarea
                value={ratingsPrompt}
                onChange={(e) => setRatingsPrompt(e.target.value)}
                rows={2}
                placeholder="How would you rate the support you received?"
              />
            </div>
          )}
        </div>

        <div>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className={disabled ? "text-muted-foreground" : ""}>{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
