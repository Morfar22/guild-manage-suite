import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function checkIPWhitelist(
  req: Request,
  supabase: any,
): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = getClientIp(req);

  const { count, error: countError } = await supabase
    .from('admin_ip_whitelist')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Failed to read IP whitelist count:', countError);
    return { allowed: false, ip: clientIp };
  }

  // If no whitelist entries exist, allow all bot requests
  if ((count ?? 0) === 0) {
    return { allowed: true, ip: clientIp };
  }

  const { data: whitelistData, error: whitelistError } = await supabase
    .from('admin_ip_whitelist')
    .select('ip_address')
    .eq('ip_address', clientIp)
    .maybeSingle();

  if (whitelistError) {
    console.error('Failed to check IP whitelist entry:', whitelistError);
    return { allowed: false, ip: clientIp };
  }

  return { allowed: !!whitelistData, ip: clientIp };
}

interface ApplicationFormQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface ApplicationForm {
  id: string;
  guild_id: string;
  name: string;
  emoji: string | null;
  enabled: boolean;
  description: string | null;
  questions: ApplicationFormQuestion[];
  granted_role_id: string | null;
  approval_channel_id: string | null;
  denial_channel_id: string | null;
}

interface ApplicationSettings {
  panel_channel_id: string | null;
  panel_message_id: string | null;
  log_channel_id: string | null;
  panel_type: 'buttons' | 'dropdown';
  dm_on_submit: boolean;
  dm_on_approval: boolean;
  dm_on_denial: boolean;
  approval_message: string | null;
  denial_message: string | null;
}

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
    );
  }
  return result;
}

async function getBotTokenForGuild(
  supabase: any,
  guildId: string,
  fallbackToken: string | undefined,
): Promise<string | undefined> {
  const { data: settings, error } = await supabase
    .from('guild_bot_settings')
    .select('is_custom_bot, is_active, bot_token_encrypted')
    .eq('guild_id', guildId)
    .eq('is_custom_bot', true)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch guild bot settings:', error);
  }

  const encryptionKey = Deno.env.get('BOT_SECRET_KEY');

  if (settings?.bot_token_encrypted && encryptionKey) {
    try {
      return simpleDecrypt(settings.bot_token_encrypted, encryptionKey);
    } catch (e) {
      console.error(
        'Failed to decrypt custom bot token, falling back to global:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return fallbackToken;
}

async function discordRequest(
  token: string,
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const globalDiscordToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const botSecret = Deno.env.get('BOT_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(
        { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing' },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { action } = body;
    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400);
    }

    console.log(`Application handler received action: ${action}`);

    const requestBotSecret = req.headers.get('x-bot-secret');
    const isBotRequest =
      !!botSecret && !!requestBotSecret && requestBotSecret === botSecret;

    // Bot requests: require matching bot secret + whitelist
    if (requestBotSecret && !isBotRequest) {
      return jsonResponse({ error: 'Unauthorized bot request' }, 401);
    }

    if (isBotRequest) {
      const ipCheck = await checkIPWhitelist(req, supabase);
      if (!ipCheck.allowed) {
        console.error(`IP not whitelisted: ${ipCheck.ip}`);
        return jsonResponse(
          { error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip },
          403,
        );
      }
    }

    // Non-bot requests must have JWT
    if (!isBotRequest) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: authError } = await supabase.auth.getUser(
        token,
      );

      if (authError || !userData.user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    switch (action) {
      case 'send_panel': {
        const { guild_id } = body;

        if (!guild_id) {
          return jsonResponse({ error: 'guild_id is required' }, 400);
        }

        const { data: guild, error: guildError } = await supabase
          .from('guilds')
          .select('guild_id')
          .eq('id', guild_id)
          .single();

        if (guildError || !guild) {
          console.error('Guild not found:', guildError);
          return jsonResponse({ error: 'Guild not found' }, 404);
        }

        const { data: settings, error: settingsError } = await supabase
          .from('application_settings')
          .select('*')
          .eq('guild_id', guild_id)
          .single();

        if (settingsError || !settings?.panel_channel_id) {
          console.error('Settings not found or no panel channel:', settingsError);
          return jsonResponse(
            { error: 'Please configure a panel channel first' },
            400,
          );
        }

        const { data: forms, error: formsError } = await supabase
          .from('application_forms')
          .select('*')
          .eq('guild_id', guild_id)
          .eq('enabled', true)
          .order('created_at', { ascending: true });

        if (formsError) {
          console.error('Error fetching forms:', formsError);
          return jsonResponse({ error: 'Failed to fetch forms' }, 500);
        }

        if (!forms || forms.length === 0) {
          return jsonResponse(
            { error: 'No enabled application forms found' },
            400,
          );
        }

        const discordBotToken = await getBotTokenForGuild(
          supabase,
          guild_id,
          globalDiscordToken,
        );

        if (!discordBotToken) {
          return jsonResponse(
            { error: 'Discord bot token not configured' },
            500,
          );
        }

        const panelType = settings.panel_type || 'buttons';

        const embed = {
          title: '📋 Applications',
          description:
            panelType === 'dropdown'
              ? 'Select an application from the dropdown below to get started.'
              : 'Click a button below to start an application.',
          color: 0x5865f2,
          fields: forms.map((form: ApplicationForm) => ({
            name: `${form.emoji || '📝'} ${form.name}`,
            value: form.description || 'No description',
            inline: false,
          })),
        };

        const components: any[] = [];

        if (panelType === 'dropdown') {
          const options = forms.map((form: ApplicationForm) => ({
            label: String(form.name).substring(0, 100),
            value: String(form.id),
            description: form.description
              ? String(form.description).substring(0, 100)
              : undefined,
            emoji: form.emoji ? { name: form.emoji } : undefined,
          }));

          components.push({
            type: 1,
            components: [
              {
                type: 3,
                custom_id: 'application_select',
                placeholder: 'Choose an application...',
                options,
              },
            ],
          });
        } else {
          let currentRow: any[] = [];

          for (let i = 0; i < forms.length; i++) {
            currentRow.push({
              type: 2,
              style: 1,
              label: String(forms[i].name).substring(0, 80),
              emoji: forms[i].emoji ? { name: forms[i].emoji } : undefined,
              custom_id: `application_start_${forms[i].id}`,
            });

            if (currentRow.length === 5 || i === forms.length - 1) {
              components.push({
                type: 1,
                components: [...currentRow],
              });
              currentRow = [];
            }
          }
        }

        if (settings.panel_message_id) {
          try {
            await discordRequest(
              discordBotToken,
              `/channels/${settings.panel_channel_id}/messages/${settings.panel_message_id}`,
              { method: 'DELETE' },
            );
          } catch (e) {
            console.log('Could not delete old panel message:', e);
          }
        }

        const response = await discordRequest(
          discordBotToken,
          `/channels/${settings.panel_channel_id}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              embeds: [embed],
              components,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Discord API error:', errorText);
          return jsonResponse({ error: 'Failed to send panel to Discord' }, 500);
        }

        const messageData = await response.json();

        await supabase
          .from('application_settings')
          .update({ panel_message_id: messageData.id })
          .eq('guild_id', guild_id);

        return jsonResponse({ success: true, message_id: messageData.id });
      }

      case 'review': {
        const {
          submission_id,
          status,
          reviewer_name,
          reviewer_discord_id,
          notes,
        } = body;

        if (!submission_id || !status) {
          return jsonResponse(
            {
              error:
                'submission_id and status are required',
            },
            400,
          );
        }

        if (!['approved', 'denied'].includes(status)) {
          return jsonResponse(
            { error: 'status must be approved or denied' },
            400,
          );
        }

        const { data: submission, error: submissionError } = await supabase
          .from('application_submissions')
          .select(`
            *,
            form:application_forms(name, emoji, granted_role_id, approval_channel_id, denial_channel_id)
          `)
          .eq('id', submission_id)
          .single();

        if (submissionError || !submission) {
          console.error('Submission not found:', submissionError);
          return jsonResponse({ error: 'Submission not found' }, 404);
        }

        const { data: guild } = await supabase
          .from('guilds')
          .select('guild_id')
          .eq('id', submission.guild_id)
          .single();

        const { data: settings } = await supabase
          .from('application_settings')
          .select('*')
          .eq('guild_id', submission.guild_id)
          .single();

        const { error: updateError } = await supabase
          .from('application_submissions')
          .update({
            status,
            reviewer_name: reviewer_name || null,
            reviewer_discord_id,
            reviewer_notes: notes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', submission_id);

        if (updateError) {
          console.error('Error updating submission:', updateError);
          return jsonResponse({ error: 'Failed to update submission' }, 500);
        }

        const discordBotToken = await getBotTokenForGuild(
          supabase,
          submission.guild_id,
          globalDiscordToken,
        );

        if (!discordBotToken || !guild) {
          return jsonResponse({
            success: true,
            message: 'Submission updated (Discord actions skipped)',
          });
        }

        const form = submission.form as {
          name: string;
          emoji: string | null;
          granted_role_id: string | null;
          approval_channel_id: string | null;
          denial_channel_id: string | null;
        };

        if (status === 'approved' && form.granted_role_id) {
          try {
            await discordRequest(
              discordBotToken,
              `/guilds/${guild.guild_id}/members/${submission.discord_user_id}/roles/${form.granted_role_id}`,
              { method: 'PUT' },
            );
            console.log(
              `Granted role ${form.granted_role_id} to user ${submission.discord_user_id}`,
            );
          } catch (e) {
            console.error('Failed to grant role:', e);
          }
        }

        const shouldDm =
          status === 'approved'
            ? settings?.dm_on_approval
            : settings?.dm_on_denial;

        if (shouldDm) {
          try {
            const dmChannelRes = await discordRequest(
              discordBotToken,
              '/users/@me/channels',
              {
                method: 'POST',
                body: JSON.stringify({
                  recipient_id: submission.discord_user_id,
                }),
              },
            );

            if (dmChannelRes.ok) {
              const dmChannel = await dmChannelRes.json();
              let message =
                status === 'approved'
                  ? settings?.approval_message ||
                    'Your application has been approved!'
                  : settings?.denial_message ||
                    'Your application has been denied.';

              message = message
                .replace(/{form_name}/g, form.name)
                .replace(/{user}/g, `<@${submission.discord_user_id}>`);

              if (notes) {
                message += `\n\n**Reviewer Notes:** ${notes}`;
              }

              await discordRequest(
                discordBotToken,
                `/channels/${dmChannel.id}/messages`,
                {
                  method: 'POST',
                  body: JSON.stringify({ content: message }),
                },
              );
            }
          } catch (e) {
            console.error('Failed to send DM:', e);
          }
        }

        const channelId =
          status === 'approved'
            ? form.approval_channel_id
            : form.denial_channel_id;

        if (channelId) {
          try {
            const color = status === 'approved' ? 0x57f287 : 0xed4245;
            const embed = {
              title: `${form.emoji || '📝'} ${form.name} ${
                status === 'approved' ? 'Approved' : 'Denied'
              }`,
              description: `<@${submission.discord_user_id}>'s application has been ${status}.`,
              color,
              fields: notes ? [{ name: 'Notes', value: notes }] : [],
              footer: { text: `Reviewed by ${reviewer_name || 'Unknown'}` },
              timestamp: new Date().toISOString(),
            };

            await discordRequest(discordBotToken, `/channels/${channelId}/messages`, {
              method: 'POST',
              body: JSON.stringify({ embeds: [embed] }),
            });
          } catch (e) {
            console.error('Failed to post to channel:', e);
          }
        }

        if (settings?.log_channel_id) {
          try {
            const color = status === 'approved' ? 0x57f287 : 0xed4245;
            const fields: Array<{ name: string; value: string; inline: boolean }> = [
              { name: 'Form', value: form.name, inline: true },
              {
                name: 'Applicant',
                value: `<@${submission.discord_user_id}>`,
                inline: true,
              },
              {
                name: 'Reviewer',
                value: reviewer_name || 'Unknown',
                inline: true,
              },
            ];

            if (notes) {
              fields.push({ name: 'Notes', value: notes, inline: false });
            }

            const embed = {
              title: `Application ${
                status === 'approved' ? 'Approved' : 'Denied'
              }`,
              color,
              fields,
              timestamp: new Date().toISOString(),
            };

            await discordRequest(
              discordBotToken,
              `/channels/${settings.log_channel_id}/messages`,
              {
                method: 'POST',
                body: JSON.stringify({ embeds: [embed] }),
              },
            );
          } catch (e) {
            console.error('Failed to log:', e);
          }
        }

        return jsonResponse({ success: true });
      }

      case 'submit': {
        const { form_id, guild_id, user_id, username, avatar, answers } = body;

        if (!form_id || !guild_id || !user_id || !Array.isArray(answers)) {
          return jsonResponse(
            { error: 'form_id, guild_id, user_id, and answers are required' },
            400,
          );
        }

        const { data: guild } = await supabase
          .from('guilds')
          .select('id')
          .eq('guild_id', guild_id)
          .single();

        if (!guild) {
          return jsonResponse({ error: 'Guild not found' }, 404);
        }

        const { data: form, error: formError } = await supabase
          .from('application_forms')
          .select('id, name, enabled')
          .eq('id', form_id)
          .eq('guild_id', guild.id)
          .eq('enabled', true)
          .single();

        if (formError || !form) {
          return jsonResponse(
            { error: 'Form not found or disabled' },
            404,
          );
        }

        const { data: submission, error: submitError } = await supabase
          .from('application_submissions')
          .insert({
            form_id,
            guild_id: guild.id,
            discord_user_id: user_id,
            discord_username: username || null,
            discord_avatar: avatar || null,
            answers,
            status: 'pending',
          })
          .select()
          .single();

        if (submitError) {
          console.error('Error creating submission:', submitError);
          return jsonResponse({ error: 'Failed to create submission' }, 500);
        }

        const { data: settings } = await supabase
          .from('application_settings')
          .select('*')
          .eq('guild_id', guild.id)
          .single();

        const discordBotToken = await getBotTokenForGuild(
          supabase,
          guild.id,
          globalDiscordToken,
        );

        if (settings?.dm_on_submit && discordBotToken) {
          try {
            const dmChannelRes = await discordRequest(
              discordBotToken,
              '/users/@me/channels',
              {
                method: 'POST',
                body: JSON.stringify({ recipient_id: user_id }),
              },
            );

            if (dmChannelRes.ok) {
              const dmChannel = await dmChannelRes.json();
              await discordRequest(
                discordBotToken,
                `/channels/${dmChannel.id}/messages`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    content: `Your ${form.name || 'application'} has been submitted and is awaiting review!`,
                  }),
                },
              );
            }
          } catch (e) {
            console.error('Failed to send confirmation DM:', e);
          }
        }

        if (settings?.log_channel_id && discordBotToken) {
          try {
            const embed = {
              title: 'New Application Submitted',
              color: 0x5865f2,
              fields: [
                { name: 'Form', value: form.name || 'Unknown', inline: true },
                { name: 'Applicant', value: `<@${user_id}>`, inline: true },
              ],
              timestamp: new Date().toISOString(),
            };

            await discordRequest(
              discordBotToken,
              `/channels/${settings.log_channel_id}/messages`,
              {
                method: 'POST',
                body: JSON.stringify({ embeds: [embed] }),
              },
            );
          } catch (e) {
            console.error('Failed to log:', e);
          }
        }

        return jsonResponse({ success: true, submission_id: submission.id });
      }

      case 'get_form': {
        const { form_id } = body;

        if (!form_id) {
          return jsonResponse({ error: 'form_id is required' }, 400);
        }

        const { data: form, error } = await supabase
          .from('application_forms')
          .select('id, name, emoji, questions, enabled')
          .eq('id', form_id)
          .eq('enabled', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching form:', error);
          return jsonResponse({ error: 'Failed to fetch form' }, 500);
        }

        if (!form) {
          return jsonResponse({ error: 'Form not found or disabled' }, 404);
        }

        return jsonResponse({ success: true, form });
      }

      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('Application handler error:', error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});