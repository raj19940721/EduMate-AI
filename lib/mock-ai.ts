export function generateMockResponse(
  question: string,
  knowledgeContext: string,
): string {
  if (
    knowledgeContext !==
    "No relevant knowledge was found."
  ) {
    const knowledgeMatch =
      knowledgeContext.match(
        /Knowledge \d+:\n([\s\S]*?)\n\nMetadata:/,
      );

    const knowledge =
      knowledgeMatch?.[1]?.trim();

    if (knowledge) {
      return `🌱 Here's what I can tell you:

${knowledge}

💡 In simple words:
This information tells us that the topic you're asking about is important for understanding how things work.

📚 Keep learning!`;
    }
  }

  return `That's a good question! 😊

I don't have specific information about this topic in my current knowledge.

Try asking me another educational question and I'll help you learn about it.`;
}