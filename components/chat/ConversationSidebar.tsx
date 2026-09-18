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
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="conversation-sidebar">
      <div className="conversation-sidebar__header">
        <h2 className="conversation-sidebar__brand">EduMate</h2>

        <button onClick={onNewChat} className="conversation-sidebar__new-chat">
          + New Chat
        </button>
      </div>

      <div className="conversation-sidebar__body">
        <p className="conversation-sidebar__label">Conversations</p>

        {conversations.length === 0 ? (
          <p className="conversation-sidebar__empty">No conversations yet</p>
        ) : (
          <div className="conversation-sidebar__list">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <div
                  key={conversation.id}
                  className={`conversation-sidebar__item ${isActive ? "is-active" : ""}`}
                >
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`conversation-sidebar__button ${isActive ? "is-active" : ""}`}
                  >
                    {conversation.title || "New Chat"}
                  </button>

                  <button
                    onClick={() => onDeleteConversation(conversation.id)}
                    className="conversation-sidebar__delete"
                    title="Delete conversation"
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
