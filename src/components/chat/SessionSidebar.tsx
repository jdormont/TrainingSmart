import React, { useState } from 'react';
import { Plus, MessageCircle, Trash2, CreditCard as Edit3, X } from 'lucide-react';
import { Button } from '../common/Button';
import { supabaseChatService } from '../../services/supabaseChatService';
import type { ChatSession } from '../../types';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void | Promise<void>;
  onSessionCreate: (name: string, category: ChatSession['category'], description?: string) => void | Promise<void>;
  onSessionDelete: (sessionId: string) => void | Promise<void>;
  onSessionRename: (sessionId: string, newName: string) => void | Promise<void>;
  onClose?: () => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionCreate,
  onSessionDelete,
  onSessionRename,
  onClose
}) => {
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionCategory, setNewSessionCategory] = useState<ChatSession['category']>('training');
  const [newSessionDescription, setNewSessionDescription] = useState('');
  const [editName, setEditName] = useState('');

  const handleSelectSession = (sessionId: string) => {
    onSessionSelect(sessionId);
    if (onClose) {
      onClose();
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    onSessionCreate(newSessionName.trim(), newSessionCategory, newSessionDescription.trim() || undefined);
    setNewSessionName('');
    setNewSessionDescription('');
    setNewSessionCategory('training');
    setShowNewSessionForm(false);

    if (onClose) {
      onClose();
    }
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

  const categoryOptions: { value: ChatSession['category']; label: string; description: string }[] = [
    { value: 'training', label: '🚴 Training Coach', description: 'Workouts, Analysis, Planning' },
    { value: 'recovery', label: '😴 Recovery Physio', description: 'Rest, HRV, Soreness' },
    { value: 'strategy', label: '🎯 Event Strategist', description: 'Race prep, pacing, nutrition' }
  ];

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-50">Chat Sessions</h2>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowNewSessionForm(true)}
              size="sm"
              className="flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* New Session Form */}
        {showNewSessionForm && (
          <form onSubmit={handleCreateSession} className="space-y-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Session name..."
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-50 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder-slate-500"
              autoFocus
            />
            <select
              value={newSessionCategory}
              onChange={(e) => setNewSessionCategory(e.target.value as ChatSession['category'])}
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-50 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 text-slate-50 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder-slate-500"
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
                  setNewSessionCategory('training');
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
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
                  className={`group rounded-lg p-3 cursor-pointer transition-all duration-200 ${activeSessionId === session.id
                    ? 'bg-orange-500/10 border border-orange-500/30'
                    : 'hover:bg-slate-800 border border-transparent hover:border-slate-700'
                    }`}
                  onClick={() => handleSelectSession(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                              className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm">
                              {supabaseChatService.getCategoryIcon(session.category)}
                            </span>
                            <h3 className={`font-medium truncate ${activeSessionId === session.id ? 'text-orange-400' : 'text-slate-200 group-hover:text-white'}`}>
                              {session.name}
                            </h3>
                          </div>

                          {session.description && (
                            <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                              {session.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700`}>
                              {session.category}
                            </span>
                            <div className="text-xs text-slate-500">
                              {session.messages.length} msgs
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 mt-1">
                            {session.updatedAt.toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>

                    {editingSessionId !== session.id && (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(session);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
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
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
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