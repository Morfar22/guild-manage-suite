import { z } from "zod";

export interface DiscordCommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordCommandOption[];
}

const optionSchema: z.ZodType<DiscordCommandOption> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.number().int(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    options: z.array(optionSchema).optional(),
  }),
);
const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().default("Unknown user"),
  avatar: z.string().nullable().optional(),
});
const inputSchema = z.object({
  custom_id: z.string(),
  value: z.string().optional(),
});
const rowSchema = z.object({ components: z.array(inputSchema).default([]) });
export const discordEmbedSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    color: z.number().optional(),
    fields: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
          inline: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

/** Validate untrusted bodies only after authenticating the original signed bytes. */
export const discordInteractionSchema = z
  .object({
    type: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    id: z.string().optional(),
    application_id: z.string().default(""),
    token: z.string().default(""),
    guild_id: z.string().default(""),
    channel_id: z.string().optional(),
    channel: z.object({ id: z.string() }).optional(),
    user: userSchema.optional(),
    member: z
      .object({
        user: userSchema.optional(),
        roles: z.array(z.string()).default([]),
        permissions: z.string().optional(),
      })
      .optional(),
    data: z
      .object({
        component_type: z.number().int().optional(),
        name: z.string().optional(),
        custom_id: z.string().optional(),
        values: z.array(z.string()).optional(),
        options: z.array(optionSchema).optional(),
        components: z.array(rowSchema).optional(),
      })
      .default({}),
    message: z
      .object({
        id: z.string().optional(),
        embeds: z.array(discordEmbedSchema).default([]),
      })
      .default({ embeds: [] }),
  })
  .superRefine((interaction, context) => {
    if (interaction.type === 1) return;
    if (!interaction.member?.user && !interaction.user) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user"],
        message: "Interaction user is required",
      });
    }
    if (!interaction.application_id || !interaction.token) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interaction application and token are required",
      });
    }
    if (interaction.type === 2 && !interaction.data.name) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "name"],
        message: "Command name is required",
      });
    }
    if (
      (interaction.type === 3 || interaction.type === 5) &&
      !interaction.data.custom_id
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "custom_id"],
        message: "Component custom ID is required",
      });
    }
  })
  .transform((interaction) => ({
    ...interaction,
    user: interaction.member?.user ??
      interaction.user ?? { id: "", username: "Unknown user" },
  }));

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;

export const ticketQuestionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  type: z.string().optional(),
  style: z.string().optional(),
});
export const ticketQuestionsSchema = z.array(ticketQuestionSchema).catch([]);
export const pollOptionsSchema = z.array(
  z.object({
    label: z.string(),
    votes: z.number().default(0),
    voters: z.array(z.string()).default([]),
  }),
);
export const pollSettingsSchema = z
  .object({ allow_multiple: z.boolean().default(false) })
  .catch({ allow_multiple: false });
export const discordChannelSchema = z.object({
  id: z.string(),
  permission_overwrites: z
    .array(
      z.object({
        id: z.string(),
        allow: z.string().optional(),
        deny: z.string().optional(),
      }),
    )
    .default([]),
});
