import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyUserFromToken, createServiceRoleClient } from "@/lib/supabase/server";
import {
  validateCourseId,
  constantTimeCompare,
} from "@/lib/validation";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 50 verification attempts per 15 minutes per user
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
      maxRequests: 50,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "verify-payment",
    });

    if (!rateLimit.allowed) {
      const headers = getRateLimitHeaders(rateLimit);
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers }
      );
    }

    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
    } = body;

    // Validate inputs
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 }
      );
    }

    // Verify Razorpay signature (CRITICAL SECURITY CHECK)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(text)
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    if (!constantTimeCompare(generated_signature, razorpay_signature)) {
      console.error("Invalid payment signature", { userId });
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // Signature verified - now enroll user
    const supabase = createServiceRoleClient();

    // Determine if bundle or single course
    const isBundle = courseId === "bundle";
    const enrollmentIds = isBundle
      ? [
          "qualifier-math-1",
          "qualifier-stats-1",
          "qualifier-computational-thinking",
        ]
      : [validateCourseId(courseId)];

    // Store payment record (for audit trail)
    const { error: paymentError } = await supabase
      .from("payment_orders")
      .insert({
        user_id: userId,
        razorpay_order_id,
        razorpay_payment_id,
        is_bundle: isBundle,
        status: "completed",
        created_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error("Payment record error:", paymentError);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    // Enroll user in course(s)
    const enrollments = enrollmentIds.map((id) => ({
      user_id: userId,
      course_id: id,
      enrolled_at: new Date().toISOString(),
    }));

    const { error: enrollError } = await supabase
      .from("enrollments")
      .upsert(enrollments, {
        onConflict: "user_id,course_id",
      });

    if (enrollError) {
      console.error("Enrollment error:", enrollError);
      return NextResponse.json(
        { error: "Failed to enroll in course" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and enrollment completed",
      enrolledCourses: enrollmentIds,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
