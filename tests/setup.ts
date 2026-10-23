import "./offline-env.mjs";
import { beforeEach, vi } from "vitest";
import { rejectNetwork } from "./mocks/fetch";

beforeEach(() => {
  vi.stubGlobal("fetch", rejectNetwork);
});
