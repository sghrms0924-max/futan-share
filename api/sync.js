import https from "node:https";

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
    const supabaseResponse = await postJson(`${baseUrl}/rest/v1/rpc/${rpcName}`, body, {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    });

    if (supabaseResponse.status < 200 || supabaseResponse.status >= 300) {
      response.status(supabaseResponse.status).json({
        error: supabaseResponse.payload?.message || supabaseResponse.text || "Supabase error",
        supabaseStatus: supabaseResponse.status,
        supabaseHost: getHost(baseUrl),
      });
      return;
    }

    response.status(200).json({ data: supabaseResponse.payload });
  } catch (error) {
    response.status(502).json({
      error: `Supabaseへ接続できませんでした: ${error.message}`,
      code: error.code || "",
      cause: error.cause?.message || "",
      supabaseHost: getHost(baseUrl),
    });
  }
}

function postJson(url, body, headers = {}) {
  const payload = JSON.stringify(body);
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, text, payload: parsed });
        });
      },
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
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
