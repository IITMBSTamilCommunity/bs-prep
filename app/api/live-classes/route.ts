import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiRateLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await apiRateLimiter.check(ip);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!sheetId || !apiKey) {
      return NextResponse.json(
        { error: "Google Sheets credentials not configured" },
        { status: 500 }
      );
    }

    // Get user's enrolled courses
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let enrolledCourseIds: string[] = [];
    if (user) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user.id);
      
      if (enrollments) {
        enrolledCourseIds = enrollments.map(e => e.course_id);
      }
    }

    // Fetch data from Google Sheets API
    // Range assumes columns: Course | Topic | Meeting Link | Time | Date | YouTube Link
    const range = "Sheet1!A2:F1000"; // Adjust sheet name and range as needed
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // Transform rows into structured data
    const classes = rows
      .filter((row: string[]) => row.length >= 5) // Ensure row has all required fields
      .map((row: string[]) => ({
        course: row[0] || "", // Changed from subject to course
        topic: row[1] || "",
        meetingLink: row[2] || "",
        time: row[3] || "",
        date: row[4] || "",
        youtubeLink: row[5] || "", // Add youtube link from column F
      }))
      .filter((cls: { course: string; topic: string }) => cls.course && cls.topic) // Filter out empty rows
      .filter((cls: { course: string }) => {
        // Keep Python classes visible for everyone in dashboard.
        const code = cls.course.toLowerCase();
        if (code === 'python') {
          return true;
        }

        // Match sheet code -> course ID for enrollment filtering.
        const courseIdMap: { [key: string]: string } = {
          'ct': 'qualifier-computational-thinking',
          'stats-1': 'qualifier-stats-1',
          'math-1': 'qualifier-math-1',
          'python': 'foundation-programming-python'
        };
        const courseId = courseIdMap[code];
        return courseId ? enrolledCourseIds.includes(courseId) : false;
      });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Error fetching live classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch live classes" },
      { status: 500 }
    );
  }
}
