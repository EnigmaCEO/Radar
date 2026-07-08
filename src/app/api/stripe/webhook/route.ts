import { NextRequest } from "next/server";
import {
  forwardRadarApiWebhook,
  toProxyResponse,
} from "@/lib/radar-api-backend";

export async function POST(request: NextRequest) {
  // Temporary adapter while the dashboard still exposes the same-origin webhook URL.
  const bodyText = await request.text();
  const response = await forwardRadarApiWebhook("/v1/stripe/webhook", {
    body: bodyText,
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      "stripe-signature": request.headers.get("stripe-signature") ?? "",
    },
  });
  return toProxyResponse(response);
}
