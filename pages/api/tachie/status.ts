import type { NextApiRequest, NextApiResponse } from "next";
import { getSignedUrl } from "@/lib/tachie/liblib/utils";
import type { StatusResponse } from "@/lib/tachie/liblib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { accessKey, secretKey, generateUuid } = req.body;

  if (!accessKey || !secretKey || !generateUuid) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const endpoint = "/api/generate/comfy/status";
    const signedUrl = getSignedUrl(accessKey, secretKey, endpoint);

    const response = await fetch(signedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ generateUuid }),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `LibLib API error: ${response.status}`
      });
    }

    const result: StatusResponse = await response.json();

    if (result.code !== 0) {
      return res.status(400).json({
        error: `LibLib API error: ${result.msg}`
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Status API error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}