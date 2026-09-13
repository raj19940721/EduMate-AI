"use client";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (
    conversationId: string,
  ) => void;
  onDeleteConversation: (
    conversationId: string,
  ) => void;
}

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r bg-gray-50">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-xl font-bold">
          EduMate
        </h2>

        <button
          onClick={onNewChat}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-gray-500">
          Conversations
        </p>

        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map(
              (conversation) => {
                const isActive =
                  conversation.id ===
                  activeConversationId;

                return (
                  <div
                    key={conversation.id}
                    className={`group flex items-center rounded-lg ${
                      isActive
                        ? "bg-blue-100"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {/* Conversation */}
                    <button
                      onClick={() =>
                        onSelectConversation(
                          conversation.id,
                        )
                      }
                      className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
                        isActive
                          ? "font-medium text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {conversation.title ||
                        "New Chat"}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() =>
                        onDeleteConversation(
                          conversation.id,
                        )
                      }
                      className="mr-2 hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600 group-hover:block"
                      title="Delete conversation"
                    >
                      🗑
                    </button>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </aside>
  );
}