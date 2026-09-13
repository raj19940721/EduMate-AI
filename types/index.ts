export interface StudentProfile {
  name: string;
  grade: number;
  subject?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}