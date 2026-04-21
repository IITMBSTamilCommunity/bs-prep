import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyUserFromToken } from "@/lib/supabase/server";
import { validateCourseId, validateAmount, validatePaymentForm } from "@/lib/validation";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

const GATEWAY_FEE_PERCENT = 2.5;

function withGatewayFee(baseAmountPaise: number): number {
  return Math.round(baseAmountPaise * (1 + GATEWAY_FEE_PERCENT / 100));
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay server credentials");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// Base prices (without gateway fee), amount in paise
const courseBasePricing: Record<string, number> = {
  "qualifier-math-1": 12900, // ₹129
  "qualifier-stats-1": 12900,
  "qualifier-computational-thinking": 12900,
  "qualifier-english-1": 12900,
};

const BUNDLE_BASE_PRICE = 49900; // ₹499 in paise

function buildReceipt(userId: string): string {
  // Razorpay receipt max length is 40 chars.
  const compactUser = userId.replace(/-/g, "").slice(0, 12);
  const compactTime = Date.now().toString(36);
  return `rcpt_${compactUser}_${compactTime}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 100 requests per 15 minutes per user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      userId = await verifyUserFromToken(token);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(userId, {
      maxRequests: 100,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "create-order",
    });

    if (!rateLimit.allowed) {
      const headers = getRateLimitHeaders(rateLimit);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers }
      );
    }

    const raw = await request.text();
    if (!raw || raw.length > 5000) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const isBundle = body?.isBundle === true;
    const courseId = isBundle ? "bundle" : validateCourseId(body?.courseId);

    // Validate payer fields to avoid malformed or abusive payloads.
    const payer = validatePaymentForm(body?.payer || {});

    // Determine amount
    let amount: number;
    let description: string;

    if (isBundle) {
      amount = withGatewayFee(BUNDLE_BASE_PRICE);
      description = "Qualifier Bundle — All 4 Courses";
    } else {
      if (!(courseId in courseBasePricing)) {
        return NextResponse.json(
          { error: "Invalid course" },
          { status: 400 }
        );
      }
      amount = courseId in courseBasePricing ? withGatewayFee(courseBasePricing[courseId]) : 0;
      description = `Course Enrollment - ${courseId}`;
    }

    // Validate amount
    validateAmount(amount);

    // Create Razorpay order
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: buildReceipt(userId),
      notes: {
        userId,
        courseId,
        baseAmountPaise: String(isBundle ? BUNDLE_BASE_PRICE : courseBasePricing[courseId]),
        gatewayFeePercent: String(GATEWAY_FEE_PERCENT),
        chargeDescription: description,
        payerName: payer.name,
        payerEmail: payer.email,
        payerPhone: payer.phone,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    });
  } catch (error) {
    console.error("Order creation error:", error);

    if (error instanceof Error && (error.name === "ZodError" || error.message.toLowerCase().includes("invalid"))) {
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Missing Razorpay server credentials")) {
      return NextResponse.json(
        { error: "Payment gateway configuration missing on server" },
        { status: 500 }
      );
    }

    const maybeRazorpayError = error as { statusCode?: number; error?: { description?: string } };
    if (maybeRazorpayError?.statusCode === 401 || maybeRazorpayError?.statusCode === 403) {
      return NextResponse.json(
        { error: "Razorpay credentials invalid or mode mismatch" },
        { status: 500 }
      );
    }

    if (maybeRazorpayError?.error?.description) {
      return NextResponse.json(
        { error: `Razorpay error: ${maybeRazorpayError.error.description}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
