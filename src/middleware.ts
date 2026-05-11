import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.searchParams.has("date")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("date");
    return NextResponse.redirect(url, 301);
  }
}

export const config = {
  matcher: "/",
};
