import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Allow 60s for Antigravity reasoning turns

const NEST_BACKEND_URL =
  process.env.NEST_BACKEND_URL || "https://wide-quilt-warranties-manager.trycloudflare.com";

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const subpath = path.join("/");
  const url = new URL(`${NEST_BACKEND_URL}/api/${subpath}`);

  // Forward query string
  req.nextUrl.searchParams.forEach((val, key) => {
    url.searchParams.set(key, val);
  });

  const headers = new Headers();
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = req.headers.get("Authorization");
  if (authorization) headers.set("Authorization", authorization);

  let body: any = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = null;
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
      // Pass-through timeout
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err: any) {
    console.error("Proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to Nest backend", details: err.message },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
