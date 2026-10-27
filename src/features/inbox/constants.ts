import type { ConversationStatus } from "@/db/schema/enums";
import type { InboxFilter } from "./queries";

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  needs_human: "Needs a person",
  human: "Team handling",
  ai: "AI handling",
  resolved: "Resolved",
};

export const FILTER_LABEL: Record<InboxFilter, string> = {
  all: "All",
  ...STATUS_LABEL,
};

export const TOOL_LABEL: Record<string, string> = {
  get_services: "Looked up services",
  get_staff: "Looked up staff",
  get_hours: "Looked up opening hours",
  get_policies: "Looked up policies",
  find_verified_answer: "Checked verified answers",
  search_knowledge: "Searched knowledge",
  check_availability: "Checked availability",
  propose_booking: "Offered a booking",
  capture_lead: "Saved contact details",
  send_manage_link: "Sent a manage link",
  handoff_to_human: "Handed off to the team",
};
