// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Calendar } from "@/components/ui/calendar";

afterEach(cleanup);

function cell(container: HTMLElement, date: string) {
  const element = container.querySelector<HTMLElement>(
    `[role="gridcell"][data-day="${date}"]`,
  );
  if (!element) throw new Error(`Missing calendar cell ${date}`);
  return element;
}

test("calendar navigation preserves custom chevrons and changes displayed months", () => {
  render(<Calendar defaultMonth={new Date(2026, 9, 1)} />);
  const previous = screen.getByRole("button", { name: /previous month/i });
  const next = screen.getByRole("button", { name: /next month/i });
  expect(previous.querySelector(".lucide-chevron-left")).not.toBeNull();
  expect(next.querySelector(".lucide-chevron-right")).not.toBeNull();
  expect(previous.className).toContain("left-1");
  expect(next.className).toContain("right-1");
  fireEvent.click(next);
  expect(screen.getByRole("grid", { name: "November 2026" })).toBeDefined();
  fireEvent.click(previous);
  expect(screen.getByRole("grid", { name: "October 2026" })).toBeDefined();
});

test("calendar selects enabled days and blocks disabled days", () => {
  const select = vi.fn();
  const { container } = render(
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 9, 1)}
      onSelect={select}
      disabled={new Date(2026, 9, 16)}
    />,
  );
  fireEvent.click(within(cell(container, "2026-10-15")).getByRole("button"));
  expect(select.mock.calls[0][0]).toEqual(new Date(2026, 9, 15));
  const disabled = within(cell(container, "2026-10-16")).getByRole("button");
  expect(disabled.hasAttribute("disabled")).toBe(true);
  fireEvent.click(disabled);
  expect(select).toHaveBeenCalledTimes(1);
});

test("calendar range puts state styles on cells and preserves distinct endpoints and middle", () => {
  const { container } = render(
    <Calendar
      mode="range"
      defaultMonth={new Date(2026, 9, 1)}
      selected={{ from: new Date(2026, 9, 15), to: new Date(2026, 9, 17) }}
      onSelect={() => {}}
    />,
  );
  const start = cell(container, "2026-10-15");
  const middle = cell(container, "2026-10-16");
  const end = cell(container, "2026-10-17");
  for (const selected of [start, middle, end])
    expect(selected.getAttribute("aria-selected")).toBe("true");
  expect(start.classList.contains("day-range-start")).toBe(true);
  expect(start.classList.contains("rounded-l-md")).toBe(true);
  expect(end.classList.contains("day-range-end")).toBe(true);
  expect(end.classList.contains("rounded-r-md")).toBe(true);
  expect(middle.classList.contains("day-range-middle")).toBe(true);
  expect(middle.className).toContain("aria-selected:bg-accent");
  expect(start.className).toContain("bg-primary");
  expect(end.className).toContain("bg-primary");
  expect(within(middle).getByRole("button").className).toContain(
    "group-aria-selected:hover:bg-transparent",
  );
});

test("calendar applies current class-name overrides to real rendered slots", () => {
  const { container } = render(
    <Calendar
      defaultMonth={new Date(2026, 9, 1)}
      classNames={{
        month_caption: "custom-caption",
        month_grid: "custom-grid",
        day: "custom-day",
      }}
    />,
  );
  expect(container.querySelector(".custom-caption")?.textContent).toContain(
    "October 2026",
  );
  expect(screen.getByRole("grid", { name: "October 2026" }).className).toBe(
    "custom-grid",
  );
  expect(cell(container, "2026-10-15").className).toContain("custom-day");
});
