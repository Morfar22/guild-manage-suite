import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  runBulkRoleUpdates,
  type BulkRoleResult,
} from "@/lib/bulk-role-runner";
import {
  useDiscordMembers,
  DiscordMember,
  DiscordRole,
} from "@/hooks/useDiscordMembers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Shield,
  RefreshCw,
  UserCog,
  Plus,
  Minus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function intToHex(color: number): string {
  if (!color) return "hsl(var(--muted-foreground))";
  return `#${color.toString(16).padStart(6, "0")}`;
}

function MemberRoleManager({
  member,
  allRoles,
  open,
  onOpenChange,
  onToggleRole,
  isToggling,
}: {
  member: DiscordMember;
  allRoles: DiscordRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (
    memberId: string,
    roleId: string,
    action: "add" | "remove",
  ) => void;
  isToggling: boolean;
}) {
  const assignableRoles = allRoles
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => b.position - a.position);

  const displayName =
    member.nick || member.user.global_name || member.user.username;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {member.user.avatar ? (
                <AvatarImage
                  src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=64`}
                />
              ) : null}
              <AvatarFallback>
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {displayName}
          </DialogTitle>
          <DialogDescription>
            Administrer roller for dette medlem
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-4">
            {assignableRoles.map((role) => {
              const hasRole = member.roles.includes(role.id);
              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: intToHex(role.color) }}
                    />
                    <span className="text-sm font-medium">{role.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={hasRole ? "destructive" : "default"}
                    disabled={isToggling}
                    onClick={() =>
                      onToggleRole(
                        member.user.id,
                        role.id,
                        hasRole ? "remove" : "add",
                      )
                    }
                  >
                    {hasRole ? (
                      <Minus className="h-3 w-3 mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    {hasRole ? "Fjern" : "Tilføj"}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function BulkRoleDialog({
  allRoles,
  members,
  open,
  onOpenChange,
  onToggleRole,
  onComplete,
  isToggling,
}: {
  allRoles: DiscordRole[];
  members: DiscordMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (
    memberId: string,
    roleId: string,
    action: "add" | "remove",
    signal: AbortSignal,
  ) => Promise<void>;
  onComplete: () => void;
  isToggling: boolean;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [action, setAction] = useState<"add" | "remove">("add");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkRoleResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const operation = useRef(0);
  const invalidateOperation = useCallback(() => {
    operation.current++;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateOperation();
      controller.current?.abort();
    };
  }, [invalidateOperation]);
  useEffect(() => {
    if (!open) {
      operation.current++;
      controller.current?.abort();
      setRunning(false);
    } else {
      setResult(null);
    }
  }, [open]);
  const assignableRoles = allRoles
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => b.position - a.position);
  const targets = members.filter((m) =>
    action === "add"
      ? !m.roles.includes(selectedRoleId)
      : m.roles.includes(selectedRoleId),
  );
  const handleBulk = async (retryFailed = false) => {
    if (!selectedRoleId || running) return;
    const ids = retryFailed
      ? (result?.failed.map((item) => item.memberId) ?? [])
      : targets.map((m) => m.user.id);
    if (!ids.length) return;
    const run = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setResult({ succeeded: [], failed: [], remaining: ids, cancelled: false });
    const completed = await runBulkRoleUpdates(
      ids,
      (memberId, signal) =>
        onToggleRole(memberId, selectedRoleId, action, signal),
      {
        signal: abort.signal,
        onProgress: (progress) => {
          if (mounted.current && operation.current === run) setResult(progress);
        },
      },
    );
    if (!mounted.current || operation.current !== run) return;
    setResult(completed);
    setRunning(false);
    onComplete();
    if (!completed.failed.length && !completed.cancelled)
      toast.success(`${completed.succeeded.length} rolleændringer bekræftet`);
  };
  const close = (value: boolean) => {
    if (!value) controller.current?.abort();
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Masse-rolletildeling</DialogTitle>
          <DialogDescription>
            Tilføj eller fjern en rolle for de filtrerede medlemmer. Stop
            forhindrer nye forespørgsler; den igangværende kan allerede være
            gennemført.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select
            value={selectedRoleId}
            disabled={running}
            onValueChange={(value) => {
              setSelectedRoleId(value);
              setResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg rolle" />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            disabled={running}
            onValueChange={(value) => {
              setAction(value as "add" | "remove");
              setResult(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Tilføj rolle</SelectItem>
              <SelectItem value="remove">Fjern rolle</SelectItem>
            </SelectContent>
          </Select>
          {result && (
            <div
              aria-live="polite"
              className="space-y-2 rounded-lg border p-3 text-sm"
            >
              <p>
                {result.succeeded.length} bekræftet · {result.failed.length}{" "}
                fejlet · {result.remaining.length} ikke behandlet
              </p>
              {result.cancelled && (
                <p>Opgaven er stoppet. Gennemførte ændringer bevares.</p>
              )}
              {result.failed.length > 0 && (
                <ul className="max-h-36 overflow-auto space-y-1">
                  {result.failed.map((item) => (
                    <li key={item.memberId}>
                      {members.find((m) => m.user.id === item.memberId)?.user
                        .username ?? item.memberId}
                      : {item.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleBulk()}
              disabled={
                !selectedRoleId || running || isToggling || !targets.length
              }
            >
              Anvend på {targets.length} medlemmer
            </Button>
            {running && (
              <Button
                variant="outline"
                onClick={() => controller.current?.abort()}
              >
                Stop
              </Button>
            )}
            {!running && !!result?.failed.length && (
              <Button variant="outline" onClick={() => void handleBulk(true)}>
                Prøv kun fejlede igen ({result.failed.length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Members() {
  const {
    members,
    roles,
    loading,
    error,
    toggleRole,
    refetch,
    guildId,
    scopeKey,
  } = useDiscordMembers();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<DiscordMember | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);

  const assignableRoles = useMemo(
    () =>
      roles
        .filter((r: DiscordRole) => r.name !== "@everyone" && !r.managed)
        .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position),
    [roles],
  );

  const filtered = useMemo(() => {
    return members.filter((m: DiscordMember) => {
      const name = (
        m.nick ||
        m.user.global_name ||
        m.user.username
      ).toLowerCase();
      const matchesSearch =
        name.includes(search.toLowerCase()) || m.user.id.includes(search);
      const matchesRole = roleFilter === "all" || m.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [members, search, roleFilter]);

  const handleToggle = (
    memberId: string,
    roleId: string,
    action: "add" | "remove",
  ) => {
    toggleRole.mutate({ memberId, roleId, action, guildId });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Medlemmer</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold">Medlemmer</h1>
        <Card role="alert">
          <CardHeader>
            <CardTitle>Kunne ikke hente medlemmer</CardTitle>
            <CardDescription>
              {error instanceof Error
                ? error.message
                : "Prøv igen om et øjeblik."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Prøv igen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medlemmer</h1>
          <p className="text-muted-foreground mt-1">
            {members.length} medlemmer indlæst
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Opdater
          </Button>
          <Button
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={filtered.length === 0}
          >
            <Shield className="h-4 w-4 mr-1" /> Masse-roller
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søg efter navn eller ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrer på rolle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle roller</SelectItem>
            {assignableRoles.map((role: DiscordRole) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: intToHex(role.color) }}
                  />
                  {role.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Members Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((member: DiscordMember) => {
          const displayName =
            member.nick || member.user.global_name || member.user.username;
          const memberRoles = assignableRoles.filter((r: DiscordRole) =>
            member.roles.includes(r.id),
          );

          return (
            <Card
              key={member.user.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => setSelectedMember(member)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar className="h-10 w-10 shrink-0">
                  {member.user.avatar ? (
                    <AvatarImage
                      src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=64`}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{member.user.username}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {memberRoles.slice(0, 3).map((r: DiscordRole) => (
                      <Badge
                        key={r.id}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{
                          borderColor: intToHex(r.color),
                          color: intToHex(r.color),
                        }}
                      >
                        {r.name}
                      </Badge>
                    ))}
                    {memberRoles.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        +{memberRoles.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
                <UserCog className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-3 opacity-50" />
          <p>Ingen medlemmer fundet</p>
        </div>
      )}

      {/* Member Role Manager Dialog */}
      {selectedMember && (
        <MemberRoleManager
          member={selectedMember}
          allRoles={roles}
          open={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          onToggleRole={handleToggle}
          isToggling={toggleRole.isPending}
        />
      )}

      {/* Bulk Role Dialog */}
      <BulkRoleDialog
        key={scopeKey}
        allRoles={roles}
        members={filtered}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onToggleRole={async (memberId, roleId, action, signal) => {
          await toggleRole.mutateAsync({
            memberId,
            roleId,
            action,
            signal,
            guildId,
            silent: true,
          });
        }}
        onComplete={() => void refetch()}
        isToggling={toggleRole.isPending}
      />
    </div>
  );
}
