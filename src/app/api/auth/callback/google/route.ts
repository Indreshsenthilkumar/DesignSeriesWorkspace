import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const loginUrl = `${origin}/login`;

  if (errorParam) {
    return NextResponse.redirect(`${loginUrl}?error=google_cancelled`);
  }

  if (!code) {
    return NextResponse.redirect(`${loginUrl}?error=missing_code`);
  }

  const cookieJar = await cookies();
  const savedState = cookieJar.get("google_oauth_state")?.value;
  cookieJar.delete("google_oauth_state");

  // Validate state
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${loginUrl}?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${loginUrl}?error=missing_oauth_credentials`);
  }

  try {
    const redirectUri = `${origin}/api/auth/callback/google`;

    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Google token exchange failed:", errorData);
      return NextResponse.redirect(`${loginUrl}?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from Google
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoResponse.ok) {
      return NextResponse.redirect(`${loginUrl}?error=userinfo_failed`);
    }

    const profile = await userinfoResponse.json();
    const googleEmail = String(profile.email || "").trim().toLowerCase();

    if (!googleEmail) {
      return NextResponse.redirect(`${loginUrl}?error=no_email_returned`);
    }

    // 3. Find user in database by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: googleEmail,
          mode: "insensitive",
        },
      },
    });

    if (!user) {
      return NextResponse.redirect(
        `${loginUrl}?error=unregistered_email&email=${encodeURIComponent(googleEmail)}`
      );
    }

    if (user.systemStatus && user.systemStatus !== "ACTIVE") {
      return NextResponse.redirect(`${loginUrl}?error=account_inactive`);
    }

    // 4. Create Session
    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // 5. Redirect based on role
    const destination = user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? "/console" : "/dashboard";
    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    console.error("Error during Google OAuth callback:", err);
    return NextResponse.redirect(`${loginUrl}?error=oauth_internal_error`);
  }
}
