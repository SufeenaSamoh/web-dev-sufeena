import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

function checkIsAsset(urlStr: string): boolean {
  try {
    const url = new URL(urlStr, "http://localhost");
    const pathname = url.pathname;
    return /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|wasm|mp4|webm|ogg|mp3|wav)$/i.test(
      pathname,
    );
  } catch {
    return false;
  }
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const urlStr = request?.url ?? "";
  const isAsset = checkIsAsset(urlStr);

  try {
    const res = await next();
    if (isAsset && res.headers.get("content-type")?.includes("text/html")) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return res;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);

    if (isAsset) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal Server Error",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }

    const accept = request?.headers?.get("accept") ?? "";
    const isHtmlRequest = accept.includes("text/html");

    if (isHtmlRequest) {
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
