export interface RagTestCase {
  id: string;
  question: string;
  grade: number;
  subject: string;
  expectedRelevance: "high" | "medium" | "low";
  expectedResult: boolean;
}

export const ragTestCases: RagTestCase[] = [
  {
    id: "plants-growth",
    question: "What do plants need to grow?",
    grade: 3,
    subject: "Science",
    expectedRelevance: "high",
    expectedResult: true,
  },

  {
    id: "multiplication",
    question: "What is 4 times 3?",
    grade: 3,
    subject: "Math",
    expectedRelevance: "high",
    expectedResult: true,
  },

  {
    id: "solar-system",
    question: "What is the Solar System?",
    grade: 3,
    subject: "Science",
    expectedRelevance: "high",
    expectedResult: true,
  },

  {
    id: "wrong-subject",
    question: "What do plants need to grow?",
    grade: 3,
    subject: "Math",
    expectedRelevance: "low",
    expectedResult: false,
  },
];
