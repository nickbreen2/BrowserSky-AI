import { NextRequest, NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import { initLemonSqueezy } from "@/lib/lemonsqueezy";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function POST(req: NextRequest) {
  const requestState = await clerk.authenticateRequest(req, {
    secretKey: process.env.CLERK_SECRET_KEY!,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  });

  if (!requestState.isSignedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = requestState.toAuth();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress ?? "";

  const { variantId } = await req.json();

  if (!variantId) {
    return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
  }

  try {
    initLemonSqueezy();

    const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email,
        custom: {
          clerk_user_id: userId,
        },
      },
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      },
    });

    const checkoutUrl = checkout.data?.data?.attributes?.url;

    if (!checkoutUrl) {
      return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
