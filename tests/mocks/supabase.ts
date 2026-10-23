import { vi } from "vitest";

export interface Query {
  table: string;
  operation: string;
  filters: [string, unknown][];
  values?: unknown;
}
export interface QueryResult {
  data: unknown;
  error: Error | null;
  count?: number;
}
export function createRealtimeChannel() {
  return {
    subscribed: false,
    callback: (_payload: unknown) => {},
    on(_type: string, _filter: unknown, callback: (payload: unknown) => void) {
      if (this.subscribed) throw Error("callbacks after subscribe");
      this.callback = callback;
      return this;
    },
    subscribe() {
      this.subscribed = true;
      return this;
    },
  };
}
type Channel = ReturnType<typeof createRealtimeChannel>;

export function createSupabaseStub(
  {
    result = () => ({ data: null, error: null }),
    channels = new Map<string, Channel>(),
    created = [] as Channel[],
    removeChannel = vi.fn(),
  } = {} as {
    result?: (query: Query) => QueryResult;
    channels?: Map<string, Channel>;
    created?: Channel[];
    removeChannel?: ReturnType<typeof vi.fn>;
  },
) {
  const queries: Query[] = [];
  return {
    queries,
    channels,
    created,
    removeChannel,
    auth: {
      getUser: vi.fn(async (token: string) => ({
        data: { user: token === "valid" ? { id: "user-a" } : null },
        error: token === "valid" ? null : new Error("Invalid token"),
      })),
    },
    from(table: string) {
      const query: Query = { table, operation: "select", filters: [] };
      queries.push(query);
      return {
        select() {
          return this;
        },
        eq(key: string, value: unknown) {
          query.filters.push([key, value]);
          return this;
        },
        in(key: string, values: unknown[]) {
          query.filters.push([key, values]);
          return this;
        },
        not(key: string, op: string, value: unknown) {
          query.filters.push([key, { op, value }]);
          return this;
        },
        upsert(values: unknown) {
          query.operation = "upsert";
          query.values = values;
          return this;
        },
        is(key: string, value: unknown) {
          query.filters.push([key, value]);
          return this;
        },
        or(key: string) {
          query.filters.push(["or", key]);
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        insert(values: unknown) {
          query.operation = "insert";
          query.values = values;
          return this;
        },
        update(values: unknown) {
          query.operation = "update";
          query.values = values;
          return this;
        },
        delete() {
          query.operation = "delete";
          return this;
        },
        async single() {
          return result(query);
        },
        async maybeSingle() {
          return result(query);
        },
        then<T>(resolve: (value: QueryResult) => T | PromiseLike<T>) {
          return Promise.resolve(result(query)).then(resolve);
        },
      };
    },
    channel(topic: string) {
      // Like Supabase, topics are reused until removal finishes.
      let channel = channels.get(topic);
      if (!channel) {
        channel = createRealtimeChannel();
        channels.set(topic, channel);
        created.push(channel);
      }
      return channel;
    },
  };
}
