import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/wms/PageHeader';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Edit2, Trash2, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api-client';
import type { User } from '@shared/types';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
  isEdited?: boolean;
  editedAt?: string;
  editHistory?: Array<{ content: string; editedAt: string }>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.permissions.includes('manage:users');
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [messageContent, setMessageContent] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      const data = await api<Message[]>('/api/wms/messages');
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api<User[]>('/api/wms/users');
      setUsers(data.filter((u) => u.id !== user?.id));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !user) return;

    try {
      if (editingMessageId) {
        await api(`/api/wms/messages/${editingMessageId}`, {
          method: 'PUT',
          body: JSON.stringify({ content: messageContent.trim() }),
        });
        setEditingMessageId(null);
      } else {
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: user.id,
          senderName: user.name,
          recipientId: selectedUser,
          content: messageContent.trim(),
          timestamp: new Date().toISOString(),
          read: false,
        };

        await api('/api/wms/messages', {
          method: 'POST',
          body: JSON.stringify(newMessage),
        });
      }
      setMessageContent('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setMessageContent(msg.content);
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !user) return;

    try {
      await api(`/api/wms/messages/${messageToDelete}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId: user.id }),
      });
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      fetchMessages();
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const getDisplayedContent = (msg: Message) => {
    if (!isAdmin || !msg.editHistory || msg.editHistory.length === 0) {
      return msg.content;
    }
    const currentIndex = historyView[msg.id] || 0;
    if (currentIndex === 0) return msg.content;
    return msg.editHistory[msg.editHistory.length - currentIndex].content;
  };

  const navigateHistory = (msgId: string, direction: 'prev' | 'next', totalVersions: number) => {
    const current = historyView[msgId] || 0;
    if (direction === 'prev' && current < totalVersions - 1) {
      setHistoryView({ ...historyView, [msgId]: current + 1 });
    } else if (direction === 'next' && current > 0) {
      setHistoryView({ ...historyView, [msgId]: current - 1 });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const companyMessages = messages.filter((msg) => msg.recipientId === 'all');
  const directMessages = messages.filter(
    (msg) =>
      (msg.senderId === user?.id && msg.recipientId === selectedUser) ||
      (msg.senderId === selectedUser && msg.recipientId === user?.id)
  );

  const renderMessages = (msgs: Message[]) => (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        {msgs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No messages yet</p>
        ) : (
          msgs.filter(msg => !msg.isDeleted || isAdmin).map((msg) => {
            const totalVersions = (msg.editHistory?.length || 0) + 1;
            const currentVersion = historyView[msg.id] || 0;
            const displayContent = getDisplayedContent(msg);
            
            return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.senderId === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(msg.senderName)}</AvatarFallback>
              </Avatar>
              <div
                className={`flex flex-col max-w-[70%] ${
                  msg.senderId === user?.id ? 'items-end' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{msg.senderName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                  {msg.isDeleted && <span className="text-xs text-destructive">(deleted)</span>}
                </div>
                <div
                  className={`rounded-lg px-3 py-2 ${
                    msg.senderId === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  } ${msg.isDeleted ? 'opacity-50 italic' : ''}`}
                >
                  {msg.isDeleted ? '[Message deleted]' : displayContent}
                </div>
                {isAdmin && msg.editHistory && msg.editHistory.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => navigateHistory(msg.id, 'prev', totalVersions)}
                      disabled={currentVersion >= totalVersions - 1}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {currentVersion === 0 ? 'Current' : `Version ${totalVersions - currentVersion}/${totalVersions}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => navigateHistory(msg.id, 'next', totalVersions)}
                      disabled={currentVersion === 0}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {msg.senderId === user?.id && !msg.isDeleted && (
                  <div className="flex gap-1 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => handleEditMessage(msg)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        setMessageToDelete(msg.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );

  return (
    <AppLayout container>
      <div className="space-y-6">
        <PageHeader
          title="Chat"
          subtitle="Communicate with your team"
        />

        <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company" onClick={() => setSelectedUser('all')}>
            Company Chat
          </TabsTrigger>
          <TabsTrigger value="direct">Direct Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            {renderMessages(companyMessages)}
            <div className="flex gap-2 mt-4">
              {editingMessageId && (
                <Button
                  onClick={() => {
                    setEditingMessageId(null);
                    setMessageContent('');
                  }}
                  size="icon"
                  variant="outline"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Input
                placeholder={editingMessageId ? 'Editing message...' : 'Type a message to everyone...'}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button onClick={handleSendMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="direct" className="space-y-4">
          <div className="grid grid-cols-[250px_1fr] gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-4">Users</h3>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {users.map((u) => (
                    <Button
                      key={u.id}
                      variant={selectedUser === u.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedUser(u.id)}
                    >
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarFallback className="text-xs">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      {u.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-lg border bg-card p-4">
              {selectedUser === 'all' ? (
                <p className="text-center text-muted-foreground py-8">
                  Select a user to start chatting
                </p>
              ) : (
                <>
                  {renderMessages(directMessages)}
                  <div className="flex gap-2 mt-4">
                    {editingMessageId && (
                      <Button
                        onClick={() => {
                          setEditingMessageId(null);
                          setMessageContent('');
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Input
                      placeholder={
                        editingMessageId
                          ? 'Editing message...'
                          : `Message ${users.find((u) => u.id === selectedUser)?.name || ''}...`
                      }
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />
                    <Button onClick={handleSendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action can be viewed by administrators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
