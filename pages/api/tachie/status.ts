import { getSignedUrl } from "@/lib/tachie/liblib/utils";
import type { StatusResponse } from "@/lib/tachie/liblib/types";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const { accessKey, secretKey, generateUuid } = await req.json();

  if (!accessKey || !secretKey || !generateUuid) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const endpoint = "/api/generate/comfy/status";
    const signedUrl = await getSignedUrl(accessKey, secretKey, endpoint);

    const response = await fetch(signedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ generateUuid }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `LibLib API error: ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const result: StatusResponse = await response.json();

    if (result.code !== 0) {
      return new Response(
        JSON.stringify({ error: `LibLib API error: ${result.msg}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Status API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}