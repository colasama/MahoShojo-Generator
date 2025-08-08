import type { NextApiRequest, NextApiResponse } from "next";
import { getSignedUrl } from "@/lib/tachie/liblib/utils";
import type { GenerateResponse, ComfyUIAppParams } from "@/lib/tachie/liblib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accessKey, secretKey, prompt } = req.body;

  if (!accessKey || !secretKey || !prompt) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const endpoint = "/api/generate/comfyui/app";
    const signedUrl = getSignedUrl(accessKey, secretKey, endpoint);

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
      return res.status(response.status).json({
        error: `LibLib API error: ${response.status}`
      });
    }

    const result: GenerateResponse = await response.json();

    if (result.code !== 0) {
      return res.status(400).json({
        error: `LibLib API error: ${result.msg}`
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Generate API error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}