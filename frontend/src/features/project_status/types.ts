export type StatusState = "todo" | "done" | "na";

export type StatusItem = {
  id: string;
  project_id: string;
  order_index: number;
  title: string;
  state: StatusState;
  completion_date: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type StatusItemListResponse = {
  items: StatusItem[];
};

export type StatusItemPayload = {
  title?: string;
  state?: StatusState;
  completion_date?: string | null;
  description?: string | null;
  order_index?: number;
};
