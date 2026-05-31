export default async function handler(request, response) {
  if (request.method === "GET") {
    response.status(200).json({
      ok: true,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasPublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
      supabaseHost: getHost(process.env.SUPABASE_URL),
    });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action, supabaseUrl, publishableKey, householdId, data, updatedAt } = request.body || {};
  const baseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || supabaseUrl);
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || publishableKey;

  if (!baseUrl || !apiKey || !householdId) {
    response.status(400).json({ error: "同期設定が足りません。" });
    return;
  }

  const rpcName = action === "save" ? "save_household_state" : "get_household_state";
  const body =
    action === "save"
      ? { p_household_id: householdId, p_data: data, p_updated_at: updatedAt || new Date().toISOString() }
      : { p_household_id: householdId };

  try {
    const supabaseResponse = await fetch(`${baseUrl}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await supabaseResponse.text();
    const payload = text ? JSON.parse(text) : null;

    if (!supabaseResponse.ok) {
      response.status(supabaseResponse.status).json({ error: payload?.message || text || "Supabase error" });
      return;
    }

    response.status(200).json({ data: payload });
  } catch (error) {
    response.status(502).json({
      error: `Supabaseへ接続できませんでした: ${error.message}`,
      cause: error.cause?.message || "",
      supabaseHost: getHost(baseUrl),
    });
  }
}

function normalizeSupabaseUrl(value = "") {
  let url = String(value).trim().replace(/\/$/, "");
  if (url.startsWith("ttps://")) url = `h${url}`;
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

function getHost(value = "") {
  try {
    return new URL(normalizeSupabaseUrl(value)).host;
  } catch {
    return "";
  }
}
