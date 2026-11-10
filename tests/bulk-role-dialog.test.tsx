// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { Untyped } from "./untyped";
vi.mock("@/hooks/useDiscordMembers", () => ({ useDiscordMembers: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: PropsWithChildren) => (
    <div role="dialog">{children}</div>
  ),
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, disabled, onValueChange, children }: Untyped) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Vælg</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: PropsWithChildren) => <>{children}</>,
  SelectItem: ({ value, children }: Untyped) => (
    <option value={value}>{children}</option>
  ),
}));
import { BulkRoleDialog } from "../src/pages/Members";
const roles = [
  { id: "role", name: "Support", position: 1, color: 0, managed: false },
];
const members = ["1", "2", "3"].map((id) => ({
  user: {
    id,
    username: "user" + id,
    discriminator: "0",
    avatar: null,
    global_name: null,
  },
  nick: null,
  roles: [],
  joined_at: "2026-01-01",
}));
afterEach(cleanup);
function chooseRole() {
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "role" },
  });
}
test("bulk dialog reports real acknowledgements and retry dispatches only failed IDs", async () => {
  const calls: string[] = [];
  let allowTwo = false;
  let first!: () => void;
  const wait = new Promise<void>((resolve) => (first = resolve));
  const update = vi.fn(async (id: string) => {
    calls.push(id);
    if (calls.length === 1) await wait;
    if (id === "2" && !allowTwo) throw Error("Missing Permissions");
  });
  const complete = vi.fn();
  render(
    <BulkRoleDialog
      allRoles={roles}
      members={members}
      open
      onOpenChange={() => {}}
      onToggleRole={update}
      onComplete={complete}
      isToggling={false}
    />,
  );
  chooseRole();
  fireEvent.click(
    screen.getByRole("button", { name: "Anvend på 3 medlemmer" }),
  );
  expect(calls).toEqual(["1"]);
  expect(screen.getByText(/0 bekræftet/)).toBeTruthy();
  await act(async () => first());
  await waitFor(() =>
    expect(screen.getByText(/2 bekræftet · 1 fejlet/)).toBeTruthy(),
  );
  allowTwo = true;
  fireEvent.click(
    screen.getByRole("button", { name: /Prøv kun fejlede igen/ }),
  );
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
  expect(calls).toEqual(["1", "2", "3", "2"]);
});
test("unmount/guild change aborts the batch and prevents subsequent updates", async () => {
  let first!: () => void;
  let signal: AbortSignal | undefined;
  const wait = new Promise<void>((resolve) => (first = resolve));
  const complete = vi.fn();
  const update = vi.fn(
    async (
      _id: string,
      _role: string,
      _action: string,
      currentSignal: AbortSignal,
    ) => {
      signal = currentSignal;
      await wait;
    },
  );
  const view = render(
    <BulkRoleDialog
      allRoles={roles}
      members={members}
      open
      onOpenChange={() => {}}
      onToggleRole={update}
      onComplete={complete}
      isToggling={false}
    />,
  );
  chooseRole();
  fireEvent.click(
    screen.getByRole("button", { name: "Anvend på 3 medlemmer" }),
  );
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => first());
  expect(update).toHaveBeenCalledTimes(1);
  expect(complete).not.toHaveBeenCalled();
});
