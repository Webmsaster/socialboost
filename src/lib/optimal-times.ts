export interface OptimalTime {
  day: string;
  times: string[];
  engagement: "high" | "medium";
}

export const optimalPostingTimes: Record<string, OptimalTime[]> = {
  linkedin: [
    { day: "Tuesday", times: ["9:00 AM", "12:00 PM"], engagement: "high" },
    { day: "Wednesday", times: ["9:00 AM", "12:00 PM"], engagement: "high" },
    { day: "Thursday", times: ["9:00 AM", "10:00 AM"], engagement: "high" },
    { day: "Monday", times: ["10:00 AM"], engagement: "medium" },
    { day: "Friday", times: ["9:00 AM"], engagement: "medium" },
  ],
  facebook: [
    { day: "Wednesday", times: ["11:00 AM", "1:00 PM"], engagement: "high" },
    { day: "Thursday", times: ["12:00 PM", "2:00 PM"], engagement: "high" },
    { day: "Friday", times: ["10:00 AM", "11:00 AM"], engagement: "high" },
    { day: "Tuesday", times: ["9:00 AM"], engagement: "medium" },
  ],
  instagram: [
    { day: "Tuesday", times: ["11:00 AM", "2:00 PM"], engagement: "high" },
    { day: "Wednesday", times: ["11:00 AM"], engagement: "high" },
    { day: "Friday", times: ["10:00 AM", "11:00 AM"], engagement: "high" },
    { day: "Thursday", times: ["11:00 AM", "2:00 PM"], engagement: "medium" },
  ],
  twitter: [
    { day: "Wednesday", times: ["9:00 AM", "12:00 PM"], engagement: "high" },
    { day: "Thursday", times: ["9:00 AM", "12:00 PM"], engagement: "high" },
    { day: "Tuesday", times: ["10:00 AM"], engagement: "medium" },
    { day: "Friday", times: ["9:00 AM"], engagement: "medium" },
  ],
  pinterest: [
    { day: "Saturday", times: ["8:00 PM", "11:00 PM"], engagement: "high" },
    { day: "Friday", times: ["3:00 PM"], engagement: "high" },
    { day: "Sunday", times: ["8:00 PM"], engagement: "medium" },
  ],
};
