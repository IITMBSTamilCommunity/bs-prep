"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Youtube } from "lucide-react";

const COURSE_DISPLAY_NAMES: Record<string, string> = {
  ct: "Computational Thinking",
  "math-1": "Mathematics for Data Science I",
  "stats-1": "Statistics I",
  "python": "Programming in Python",
  "math-2": "Mathematics for Data Science II",
  "stats-2": "Statistics II",
  "english-1": "English I",
  "english-2": "English II",
};

function getCourseDisplayName(code: string): string {
  return COURSE_DISPLAY_NAMES[code.toLowerCase()] ?? code;
}

function formatTime12hr(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface LiveClassCardProps {
  course: string;
  topic: string;
  meetingLink: string;
  time: string;
  date: string;
  youtubeLink?: string;
}

export function LiveClassCard({
  course,
  topic,
  meetingLink,
  time,
  date,
  youtubeLink,
}: LiveClassCardProps) {
  const getStatus = (): "live" | "upcoming" | "completed" => {
    const now = new Date();
    const classDate = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    classDate.setHours(hours, minutes, 0, 0);
    const diffMins = Math.floor((classDate.getTime() - now.getTime()) / 60000);
    if (diffMins < -60) return "completed";
    if (diffMins <= 15 && diffMins >= -60) return "live";
    return "upcoming";
  };

  const status = getStatus();

  const statusBadge = {
    live: "bg-red-500/10 text-red-600 border border-red-200",
    upcoming: "bg-blue-500/10 text-blue-700 border border-blue-200",
    completed: "bg-gray-100 text-gray-500 border border-gray-200",
  };

  const statusLabel = {
    live: "● Live",
    upcoming: "Upcoming",
    completed: "Completed",
  };

  return (
    <Card className="bg-white border border-gray-200 hover:border-black transition-all duration-200 hover:shadow-lg rounded-xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <Badge className={`text-xs font-semibold px-2 py-0.5 ${statusBadge[status]}`}>
              {status === "live" && <Video className="w-3 h-3 mr-1" />}
              {statusLabel[status]}
            </Badge>
            <Calendar className="w-4 h-4 text-gray-400" />
          </div>

          {/* Course */}
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Course</p>
            <h3 className="font-bold text-black text-base leading-snug line-clamp-2">
              {getCourseDisplayName(course)}
            </h3>
          </div>

          {/* Topic */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Topic</p>
            <p className="text-sm text-gray-700 leading-snug line-clamp-2 font-medium">
              {topic}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-medium">{formatDate(date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-medium">{formatTime12hr(time)}</span>
            </div>
          </div>

          {status === "completed" ? (
            youtubeLink ? (
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
                onClick={() => window.open(youtubeLink, "_blank")}
              >
                <Youtube className="w-4 h-4 mr-2" />
                Watch Recording
              </Button>
            ) : (
              <Button className="w-full bg-gray-100 text-gray-400 font-semibold text-sm cursor-not-allowed" disabled>
                <Video className="w-4 h-4 mr-2" />
                No Recording Available
              </Button>
            )
          ) : (
            <Button
              className="w-full bg-black hover:bg-black/80 text-white font-semibold text-sm"
              onClick={() => window.open(meetingLink, "_blank")}
              disabled={!meetingLink}
            >
              <Video className="w-4 h-4 mr-2" />
              {status === "live" ? "Join Now" : "Join Meeting"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
