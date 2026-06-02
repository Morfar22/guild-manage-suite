/**
 * Realtime Retry Utility
 * 
 * Wraps a Supabase Realtime subscription with automatic
 * resubscription on TIMED_OUT or CHANNEL_ERROR.
 */

function createRealtimeSubscription(supabase, channelName, listeners, { maxRetries = 5, retryDelayMs = 5000, label = channelName } = {}) {
  let currentChannel = null;
  let retryCount = 0;
  let retryTimer = null;
  let destroyed = false;

  function subscribe() {
    if (destroyed) return;

    // Remove old channel if it exists
    if (currentChannel) {
      try { supabase.removeChannel(currentChannel); } catch (_) {}
    }

    // Use unique channel name to avoid conflicts on resubscribe
    const uniqueName = `${channelName}-${Date.now()}`;
    currentChannel = supabase.channel(uniqueName);

    // Attach all listeners
    for (const listener of listeners) {
      currentChannel.on(
        'postgres_changes',
        listener.filter,
        listener.callback
      );
    }

    currentChannel.subscribe((status) => {
      if (destroyed) return;

      if (status === 'SUBSCRIBED') {
        retryCount = 0;
        console.log(`[Realtime] ✅ ${label} subscribed`);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] ⚠️ ${label} status: ${status} (retry ${retryCount + 1}/${maxRetries})`);

        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelayMs * retryCount; // linear backoff
          retryTimer = setTimeout(() => subscribe(), delay);
        } else {
          console.error(`[Realtime] ❌ ${label} gave up after ${maxRetries} retries`);
        }
      } else if (status === 'CLOSED') {
        // Expected on destroy, no action
      }
    });
  }

  subscribe();

  return {
    destroy() {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch (_) {}
      }
    }
  };
}

module.exports = { createRealtimeSubscription };
