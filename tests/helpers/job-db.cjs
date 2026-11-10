// Transport fake for handler tests; the SQL protocol itself is exercised against
// Postgres by durable-jobs.node.mjs, including contention and lease recovery.
function createJobDb(tables, options = {}) {
  const db = structuredClone(tables);
  const clock = options.clock || (() => Date.now());
  let sequence = 0;
  for (const rows of Object.values(db)) {
    for (const row of rows) {
      row.delivery_status ||=
        row.sent || row.is_sent || row.executed ? "sent" : "pending";
      row.attempt_count ||= 0;
    }
  }
  return {
    db,
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        in(key, values) {
          filters.push((r) => values.includes(r[key]));
          return query;
        },
        lte(key, value) {
          filters.push((r) => r[key] <= value);
          return query;
        },
        order() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: (db[table] || [])
              .filter((r) => filters.every((f) => f(r)))
              .map((r) => ({ ...r })),
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      const rows = db[args.p_table];
      const row = rows?.find((r) => r.id === args.p_id);
      const now = clock();
      if (name === "claim_bot_job") {
        if (
          !row ||
          ["sent", "failed"].includes(row.delivery_status) ||
          (row.delivery_status === "processing" &&
            new Date(row.lease_expires_at).getTime() > now) ||
          (row.delivery_status === "pending" &&
            new Date(row.next_attempt_at).getTime() > now)
        )
          return { data: null, error: null };
        if (
          row.attempt_count >= 5 ||
          (row.action_type === "kick" && row.delivery_status === "processing")
        ) {
          row.delivery_status = "failed";
          return { data: null, error: null };
        }
        Object.assign(row, {
          delivery_status: "processing",
          attempt_count: row.attempt_count + 1,
          lease_token: `lease-${++sequence}`,
          lease_expires_at: new Date(
            now + args.p_lease_seconds * 1000,
          ).toISOString(),
        });
        return { data: { ...row }, error: null };
      }
      if (
        !row ||
        row.delivery_status !== "processing" ||
        row.lease_token !== args.p_lease_token
      )
        return { data: false, error: null };
      if (name === "extend_bot_job_lease") {
        row.lease_expires_at = new Date(
          now + args.p_lease_seconds * 1000,
        ).toISOString();
        return { data: true, error: null };
      }
      if (name !== "finish_bot_job") throw new Error(`Unexpected RPC ${name}`);
      if (options.failAcknowledgement && args.p_success)
        return {
          data: null,
          error: { message: "connection lost during acknowledgment" },
        };
      if (args.p_success) {
        Object.assign(row, {
          delivery_status: "sent",
          last_error: null,
          delivery_message_id: args.p_message_id,
        });
        if (args.p_table === "scheduled_actions") row.executed = true;
        else {
          row.sent = true;
          if (args.p_table === "reminders") row.is_sent = true;
        }
        if (
          args.p_next_at &&
          !rows.some((r) => r.recurrence_parent_id === row.id)
        ) {
          rows.push({
            ...row,
            id: `next-${++sequence}`,
            recurrence_parent_id: row.id,
            [args.p_table === "reminders" ? "remind_at" : "scheduled_at"]:
              args.p_next_at,
            delivery_status: "pending",
            attempt_count: 0,
            sent: false,
            is_sent: false,
            lease_token: null,
            lease_expires_at: null,
          });
        }
      } else {
        const terminal = args.p_permanent || row.attempt_count >= 5;
        Object.assign(row, {
          delivery_status: terminal ? "failed" : "pending",
          last_error: args.p_error,
          next_attempt_at: terminal
            ? null
            : new Date(
                now + 30_000 * 2 ** (row.attempt_count - 1),
              ).toISOString(),
        });
      }
      row.lease_token = null;
      row.lease_expires_at = null;
      return { data: true, error: null };
    },
  };
}
module.exports = { createJobDb };
