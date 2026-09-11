export interface StudentProfile {
  name: string;
  grade: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}