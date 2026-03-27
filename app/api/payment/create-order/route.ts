import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyUserFromToken } from "@/lib/supabase/server";
import { validateCourseId, validateAmount } from "@/lib/validation";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

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

// Course pricing (amount in paise)
const coursePricing: Record<string, number> = {
  "qualifier-math-1": 9900, // ₹99
  "qualifier-stats-1": 9900,
  "qualifier-computational-thinking": 9900,
};

const BUNDLE_PRICE = 24900; // ₹249 in paise

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

    // Parse request body
    const body = await request.json();
    const courseId = validateCourseId(body.courseId);
    const isBundle = body.isBundle === true;

    // Determine amount
    let amount: number;
    let description: string;

    if (isBundle) {
      amount = BUNDLE_PRICE;
      description = "Qualifier Bundle — All 3 Courses";
    } else {
      if (!(courseId in coursePricing)) {
        return NextResponse.json(
          { error: "Invalid course" },
          { status: 400 }
        );
      }
      amount = courseId in coursePricing ? coursePricing[courseId] : 0;
      description = `Course Enrollment - ${courseId}`;
    }

    // Validate amount
    validateAmount(amount);

    // Create Razorpay order
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        userId,
        courseId: isBundle ? "bundle" : courseId,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
