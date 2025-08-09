import { getSignedUrl } from "@/lib/tachie/liblib/utils";
import type { GenerateResponse, ComfyUIAppParams } from "@/lib/tachie/liblib/types";

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

  const { accessKey, secretKey, prompt } = await req.json();

  if (!accessKey || !secretKey || !prompt) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const endpoint = "/api/generate/comfyui/app";
    const signedUrl = await getSignedUrl(accessKey, secretKey, endpoint);

    // 预设参数
    const generateParams: ComfyUIAppParams = {
      105: {
        class_type: "CLIPTextEncode",
        inputs: {
          text: prompt
        }
      },
      workflowUuid: "34fed183375249dfbe293fa99d753cc5"
    };
    const response = await fetch(signedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateUuid: "4df2efa0f18d46dc9758803e478eb51c",
        generateParams: generateParams
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `LibLib API error: ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const result: GenerateResponse = await response.json();

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
    console.error("Generate API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}