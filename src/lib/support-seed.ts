import { prisma } from "./prisma";

export const INITIAL_FAQS = [
  {
    title: "How is Missed OTP Attendance recorded?",
    category: "MISSED_OTP",
    module: "ATTENDANCE",
    question: "How do I log attendance if I did not receive an OTP or had a session conflict?",
    answer:
      "Go to My Portal → Missed OTP Attendance. Choose the hour slots you attended (slots 1 to 7). Enter a brief reason (up to 65 characters) and click Submit. Same-day submissions are accepted until 11:30 PM. Each day allows a single submission.",
    tags: "missed otp, attendance, slots, check-in, cutoff",
  },
  {
    title: "Can I submit or edit worklog for a previous date?",
    category: "WORKLOG",
    module: "WORKLOG",
    question: "Why does the date selector only show Today in the worklog editor?",
    answer:
      "By institutional policy, worklogs must be submitted on the same day by 11:30 PM. If you were absent or participating in an external event, submit an Extension Request from your Worklog history page for your mentor's review.",
    tags: "worklog, extension, locked date, yesterday, deadline",
  },
  {
    title: "How do reward points get calculated?",
    category: "DASHBOARD",
    module: "DASHBOARD",
    question: "How are student reward points earned and where can I track them?",
    answer:
      "Points are awarded automatically for daily worklog submissions (+15 pts), verified LinkedIn build-in-public posts (+25 pts), task completions (+50-100 pts), and full day attendance streaks. View your badge breakdown under Leaderboard.",
    tags: "reward points, streak, leaderboard, gamification",
  },
  {
    title: "How do I request an Activity Gate Pass?",
    category: "GENERAL",
    module: "PROFILE",
    question: "What is the procedure for studio gate pass authorization?",
    answer:
      "Navigate to Activity Passes in the menu, select your departure and return time, destination, and rationale. Once approved by a mentor or faculty, your digital slip generates an authenticated pass code to present at security.",
    tags: "activity pass, gate pass, slip, mentor approval",
  },
  {
    title: "What do I do if a task assigned to me is blocked?",
    category: "TASK",
    module: "TASKS",
    question: "How can I notify my mentor if I encounter blockers in an assigned task?",
    answer:
      "Open Tasks from the navigation, select the task and toggle its status to 'Blocked'. Mention the impediment in your daily worklog slot. Your mentor will receive an alert in the Console review queue.",
    tags: "task, blocker, mentor, sprint, deliverables",
  },
  {
    title: "How do I update my Academic Mentor or Domain?",
    category: "ACCOUNT",
    module: "PROFILE",
    question: "My assigned domain or mentor name displayed on the profile is incorrect.",
    answer:
      "Student domain and faculty allocations are mapped at the start of each semester. To request an update, raise a ticket here under Account & Profile selecting 'Mentor information mismatch' with your faculty approval copy.",
    tags: "domain, mentor, faculty, profile, department",
  },
];

export async function ensureFaqArticles() {
  try {
    const count = await prisma.faqArticle.count();
    if (count === 0) {
      await prisma.faqArticle.createMany({
        data: INITIAL_FAQS,
      });
    }
  } catch (err) {
    // Graceful fallback if already populated
  }
}
