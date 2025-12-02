import React, { useState } from 'react';
import { Plus, MessageCircle, Trash2, CreditCard as Edit3, X } from 'lucide-react';
import { Button } from '../common/Button';
import { chatSessionService } from '../../services/chatSessionService';
import type { ChatSession } from '../../types';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void | Promise<void>;
  onSessionCreate: (name: string, category: ChatSession['category'], description?: string) => void | Promise<void>;
  onSessionDelete: (sessionId: string) => void | Promise<void>;
  onSessionRename: (sessionId: string, newName: string) => void | Promise<void>;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename
}) => {
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionCategory, setNewSessionCategory] = useState<ChatSession['category']>('general');
  const [newSessionDescription, setNewSessionDescription] = useState('');
  const [editName, setEditName] = useState('');

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    onSessionCreate(newSessionName.trim(), newSessionCategory, newSessionDescription.trim() || undefined);
    setNewSessionName('');
    setNewSessionDescription('');
    setNewSessionCategory('general');
    setShowNewSessionForm(false);
  };

  const handleRename = (sessionId: string) => {
    if (!editName.trim()) return;
    onSessionRename(sessionId, editName.trim());
    setEditingSessionId(null);
    setEditName('');
  };

  const startEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditName(session.name);
  };

  const categoryOptions: { value: ChatSession['category']; label: string }[] = [
    { value: 'training', label: '🚴 Training' },
    { value: 'recovery', label: '😴 Recovery' },
    { value: 'nutrition', label: '🥗 Nutrition' },
    { value: 'goals', label: '🎯 Goals' },
    { value: 'analysis', label: '📊 Analysis' },
    { value: 'general', label: '💬 General' },
    { value: 'content_preferences', label: '📺 Content Preferences' }
  ];

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Chat Sessions</h2>
          <Button
            onClick={() => setShowNewSessionForm(true)}
            size="sm"
            className="flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </Button>
        </div>
        
        {/* New Session Form */}
        {showNewSessionForm && (
          <form onSubmit={handleCreateSession} className="space-y-3 p-3 bg-gray-50 rounded-md">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Session name..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
              autoFocus
            />
            <select
              value={newSessionCategory}
              onChange={(e) => setNewSessionCategory(e.target.value as ChatSession['category'])}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newSessionDescription}
              onChange={(e) => setNewSessionDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <div className="flex space-x-2">
              <Button type="submit" size="sm" className="flex-1">
                Create
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewSessionForm(false);
                  setNewSessionName('');
                  setNewSessionDescription('');
                  setNewSessionCategory('general');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No chat sessions yet</p>
            <p className="text-xs">Create your first session to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {[...sessions]
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
              .map((session) => (
                <div
                  key={session.id}
                  className={`group rounded-md p-3 cursor-pointer transition-colors ${
                    activeSessionId === session.id
                      ? 'bg-orange-50 border border-orange-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSessionSelect(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRename(session.id);
                              } else if (e.key === 'Escape') {
                                setEditingSessionId(null);
                                setEditName('');
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleRename(session.id)}
                              className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingSessionId(null);
                                setEditName('');
                              }}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm">
                              {chatSessionService.getCategoryIcon(session.category)}
                            </span>
                            <h3 className="font-medium text-gray-900 truncate">
                              {session.name}
                            </h3>
                          </div>
                          
                          {session.description && (
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {session.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-1 rounded-full ${chatSessionService.getCategoryColor(session.category)}`}>
                              {session.category}
                            </span>
                            <div className="text-xs text-gray-500">
                              {session.messages.length} messages
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-400 mt-1">
                            {session.updatedAt.toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>

                    {editingSessionId !== session.id && (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(session);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Rename session"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this chat session? This cannot be undone.')) {
                              onSessionDelete(session.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionSidebar;