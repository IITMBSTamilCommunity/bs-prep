import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { verifyUserFromToken, createServiceRoleClient } from "@/lib/supabase/server";
import { constantTimeCompare } from "@/lib/validation";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { sendCourseWelcomeEmail } from "@/lib/notifications/course-welcome-email";

const GATEWAY_FEE_PERCENT = 2.5;

function withGatewayFee(baseAmountPaise: number): number {
  return Math.round(baseAmountPaise * (1 + GATEWAY_FEE_PERCENT / 100));
}

const courseBasePricing: Record<string, number> = {
  "qualifier-math-1": 12900,
  "qualifier-stats-1": 12900,
  "qualifier-computational-thinking": 12900,
  "qualifier-english-1": 12900,
  bundle: 49900,
};

const payableCoursePricing: Record<string, number> = Object.fromEntries(
  Object.entries(courseBasePricing).map(([courseId, amount]) => [courseId, withGatewayFee(amount)])
) as Record<string, number>;

const coursePricing: Record<string, number> = payableCoursePricing;

const courseFallbackTitles: Record<string, string> = {
  "qualifier-math-1": "Mathematics 1",
  "qualifier-stats-1": "Statistics 1",
  "qualifier-computational-thinking": "Computational Thinking",
  "qualifier-english-1": "English I",
  bundle: "Qualifier Bundle (4 Courses)",
};

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

async function submitPaymentLeadToGoogleForm(name: string, email: string, phone: string) {
  // Convert Google Form view URL to the POST endpoint.
  const formResponseUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSfwxUYJufgt94JoqCBU0Ob3C5Hj-uRHIydWk0OyiAafrfFgXg/formResponse";

  const payload = new URLSearchParams({
    "entry.1404716213": name,
    "entry.1770411357": email,
    "entry.388970807": phone,
  });

  const response = await fetch(formResponseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Google Form submit failed with status ${response.status}`);
  }
}

function toAbsoluteAssetUrl(assetPath: string | null | undefined, siteUrl: string): string | null {
  if (!assetPath) {
    return null
  }

  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath
  }

  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`
  return new URL(normalizedPath, siteUrl).toString()
}

function resolveCourseEmailData(
  enrollmentIds: string[],
  courseRows: Array<{ id: string; title: string; thumbnail: string | null }> | null | undefined,
  siteUrl: string
): Array<{ title: string; thumbnailUrl: string | null }> {
  return enrollmentIds.map((courseId) => {
    const match = courseRows?.find((row) => row.id === courseId)
    const title = match?.title || courseFallbackTitles[courseId] || courseId
    const thumbnailUrl = toAbsoluteAssetUrl(match?.thumbnail ?? null, siteUrl)

    return {
      title,
      thumbnailUrl,
    }
  })
}

async function updateWelcomeEmailStatus(
  supabase: ReturnType<typeof createServiceRoleClient>,
  razorpayPaymentId: string,
  sentAt: string | null,
  errorMessage: string | null
) {
  const updatePayload: Record<string, string | null> = {
    welcome_email_sent_at: sentAt,
    welcome_email_error: errorMessage,
  }

  const { error } = await supabase
    .from("payment_orders")
    .update(updatePayload)
    .eq("razorpay_payment_id", razorpayPaymentId)

  if (error) {
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bsprep.in"

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
    const razorpay_order_id = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const razorpay_payment_id = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const razorpay_signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

    // Validate inputs
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment details" },
        { status: 400 }
      );
    }

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpaySecret) {
      return NextResponse.json({ error: "Payment gateway misconfigured" }, { status: 500 });
    }

    // Verify Razorpay signature (CRITICAL SECURITY CHECK)
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac("sha256", razorpaySecret)
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

    const razorpay = getRazorpayClient();

    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);

    const expectedCourseId = typeof order.notes?.courseId === "string" ? order.notes.courseId : "";
    const expectedUserId = typeof order.notes?.userId === "string" ? order.notes.userId : "";
    const payerName = typeof order.notes?.payerName === "string" ? order.notes.payerName : "";
    const payerEmail = typeof order.notes?.payerEmail === "string" ? order.notes.payerEmail : "";
    const payerPhone = typeof order.notes?.payerPhone === "string" ? order.notes.payerPhone : "";

    if (!expectedCourseId || !(expectedCourseId in coursePricing)) {
      return NextResponse.json({ error: "Invalid order metadata" }, { status: 400 });
    }

    if (expectedUserId !== userId) {
      return NextResponse.json({ error: "Order does not belong to user" }, { status: 403 });
    }

    if (payment.order_id !== razorpay_order_id || payment.status !== "captured") {
      return NextResponse.json({ error: "Payment not captured" }, { status: 400 });
    }

    if (payment.currency !== "INR" || payment.amount !== coursePricing[expectedCourseId]) {
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
    }

    // Signature and Razorpay records verified - now enroll user
    const supabase = createServiceRoleClient();

    const { data: existingPayment } = await supabase
      .from("payment_orders")
      .select("id, user_id, welcome_email_sent_at")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      if (existingPayment.user_id !== userId) {
        return NextResponse.json({ error: "Duplicate payment conflict" }, { status: 409 });
      }

      if (!existingPayment.welcome_email_sent_at) {
        const isBundle = expectedCourseId === "bundle";
        const enrollmentIds = isBundle
          ? [
              "qualifier-math-1",
              "qualifier-stats-1",
              "qualifier-computational-thinking",
              "qualifier-english-1",
            ]
          : [expectedCourseId];

        const { data: courseRows, error: courseError } = await supabase
          .from("courses")
          .select("id, title, thumbnail")
          .in("id", enrollmentIds);

        if (courseError) {
          console.error("Course lookup error for welcome email:", courseError);
        }

        const courses = resolveCourseEmailData(enrollmentIds, courseRows, siteUrl)

        try {
          await sendCourseWelcomeEmail({
            studentName: payerName || "there",
            studentEmail: payerEmail,
            courses,
          });

          await updateWelcomeEmailStatus(
            supabase,
            razorpay_payment_id,
            new Date().toISOString(),
            null
          )
        } catch (welcomeEmailError) {
          console.error("Welcome email retry failed:", welcomeEmailError);

          await updateWelcomeEmailStatus(
            supabase,
            razorpay_payment_id,
            null,
            welcomeEmailError instanceof Error ? welcomeEmailError.message : "Unknown email error"
          ).catch((updateError) => {
            console.error("Failed to update welcome email error state:", updateError)
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: "Payment already verified",
      });
    }

    // Determine if bundle or single course
    const isBundle = expectedCourseId === "bundle";
    const enrollmentIds = isBundle
      ? [
          "qualifier-math-1",
          "qualifier-stats-1",
          "qualifier-computational-thinking",
          "qualifier-english-1",
        ]
      : [expectedCourseId];

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

    const { data: courseRows, error: courseError } = await supabase
      .from("courses")
      .select("id, title, thumbnail")
      .in("id", enrollmentIds);

    if (courseError) {
      console.error("Course lookup error for welcome email:", courseError);
    }

    const courses = resolveCourseEmailData(enrollmentIds, courseRows, siteUrl)

    try {
      await sendCourseWelcomeEmail({
        studentName: payerName || "there",
        studentEmail: payerEmail,
        courses,
      });

      await updateWelcomeEmailStatus(
        supabase,
        razorpay_payment_id,
        new Date().toISOString(),
        null
      )
    } catch (welcomeEmailError) {
      console.error("Welcome email send failed:", welcomeEmailError);

      await updateWelcomeEmailStatus(
        supabase,
        razorpay_payment_id,
        null,
        welcomeEmailError instanceof Error ? welcomeEmailError.message : "Unknown email error"
      ).catch((updateError) => {
        console.error("Failed to update welcome email error state:", updateError)
      })
    }

    // Payment is verified and access is granted. Now send the captured checkout details to Google Form.
    if (payerName && payerEmail && payerPhone) {
      try {
        await submitPaymentLeadToGoogleForm(payerName, payerEmail, payerPhone);
      } catch (googleFormError) {
        // Do not fail a valid payment if Google Form submission has a transient error.
        console.error("Google Form submission failed:", googleFormError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and enrollment completed",
      enrolledCourses: enrollmentIds,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    if (error instanceof Error && (error.name === "ZodError" || error.message.toLowerCase().includes("invalid"))) {
      return NextResponse.json(
        { error: "Invalid verification payload" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
