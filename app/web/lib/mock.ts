// Demo data used when NEXT_PUBLIC_DEV_BYPASS_AUTH=1.
// Lets you preview the UI without a live Supabase project.

export const mockSessionsCount = 7;

export const mockMetrics = [
  {
    cohort: "base" as const,
    avg_talk_min: 11.4,
    silent_sessions: 3,
    det_gain: 5.2,
    ixl_gain: 8.1,
    confidence_gain: 0.62,
    pct_would_continue: 82,
  },
  {
    cohort: "foundation" as const,
    avg_talk_min: 12.1,
    silent_sessions: 2,
    det_gain: 5.7,
    ixl_gain: 9.4,
    confidence_gain: 0.71,
    pct_would_continue: 91,
  },
];

export const mockRoster = [
  {
    student_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Amani K.",
    cohort: "base" as const,
    sessions_done: 9,
    avg_talk_min: 8.4,
    silent_sessions: 3,
    latest_memory: null,
  },
  {
    student_id: "00000000-0000-0000-0000-000000000002",
    display_name: "Jolie U.",
    cohort: "foundation" as const,
    sessions_done: 11,
    avg_talk_min: 13.2,
    silent_sessions: 1,
    latest_memory: null,
  },
  {
    student_id: "00000000-0000-0000-0000-000000000003",
    display_name: "Patrick M.",
    cohort: "base" as const,
    sessions_done: 8,
    avg_talk_min: 12.0,
    silent_sessions: 0,
    latest_memory: null,
  },
  {
    student_id: "00000000-0000-0000-0000-000000000004",
    display_name: "Diane I.",
    cohort: "foundation" as const,
    sessions_done: 10,
    avg_talk_min: 14.7,
    silent_sessions: 0,
    latest_memory: null,
  },
  {
    student_id: "00000000-0000-0000-0000-000000000005",
    display_name: "Eric N.",
    cohort: "base" as const,
    sessions_done: 6,
    avg_talk_min: 7.1,
    silent_sessions: 2,
    latest_memory: null,
  },
];

export const mockRosterForForm = mockRoster.map((r) => ({
  id: r.student_id,
  name: r.display_name!,
}));

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

export const mockToday = {
  date: today,
  current_session_no: 8,
  students_done_today: 3,
  students_total: mockRoster.length,
  silent_today: 1,
  current_session_topic: "Disagree with someone you respect",
};

export const mockActivity = [
  {
    student_id: mockRoster[1].student_id,
    student_name: mockRoster[1].display_name!,
    session_no: 11,
    held_on: today,
    talk_min: 13,
    flagged_low_talk: false,
  },
  {
    student_id: mockRoster[3].student_id,
    student_name: mockRoster[3].display_name!,
    session_no: 10,
    held_on: today,
    talk_min: 15,
    flagged_low_talk: false,
  },
  {
    student_id: mockRoster[0].student_id,
    student_name: mockRoster[0].display_name!,
    session_no: 9,
    held_on: today,
    talk_min: 7,
    flagged_low_talk: true,
  },
  {
    student_id: mockRoster[2].student_id,
    student_name: mockRoster[2].display_name!,
    session_no: 8,
    held_on: yesterday,
    talk_min: 12,
    flagged_low_talk: false,
  },
  {
    student_id: mockRoster[4].student_id,
    student_name: mockRoster[4].display_name!,
    session_no: 6,
    held_on: yesterday,
    talk_min: 7,
    flagged_low_talk: true,
  },
];
