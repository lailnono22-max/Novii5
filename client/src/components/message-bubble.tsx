import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { api, type Message, type Profile } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  otherUser?: Profile;
  currentUserId?: string;
}

export function MessageBubble({ message, isMe, otherUser, currentUserId }: MessageBubbleProps) {
  const { direction } = useLanguage();
  const isRTL = direction === "rtl";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const updateMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.updateMessage(messageId, content),
    onSuccess: () => {
      toast.success(isRTL ? "تم تعديل الرسالة" : "Message edited");
      setIsEditing(false);
      // Invalidate queries to refresh messages
      if (otherUser) {
        queryClient.invalidateQueries({ queryKey: ['messages', otherUser.id] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? "فشل تعديل الرسالة" : "Failed to edit message"));
      setEditedContent(message.content); // Reset to original
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => api.deleteMessage(messageId),
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الرسالة" : "Message deleted");
      setShowDeleteDialog(false);
      // Invalidate queries to refresh messages
      if (otherUser) {
        queryClient.invalidateQueries({ queryKey: ['messages', otherUser.id] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? "فشل حذف الرسالة" : "Failed to delete message"));
    },
  });

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      updateMessageMutation.mutate({
        messageId: message.id,
        content: editedContent.trim(),
      });
    } else {
      setIsEditing(false);
      setEditedContent(message.content);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleDelete = () => {
    deleteMessageMutation.mutate(message.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Show deleted message placeholder
  if (message.is_deleted) {
    return (
      <div 
        className={cn(
          "flex w-full gap-2",
          isMe ? "justify-end" : "justify-start"
        )}
      >
        {!isMe && otherUser && (
          <Avatar className="w-8 h-8 mt-1">
            <AvatarImage src={otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`} />
            <AvatarFallback>{otherUser.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
        <div className={cn(
          "max-w-[70%] rounded-3xl px-4 py-2 text-sm italic opacity-60",
          "bg-muted text-muted-foreground border border-border"
        )}>
          {isRTL ? "تم حذف هذه الرسالة" : "This message was deleted"}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex w-full gap-2 group animate-in slide-in-from-bottom-2 duration-300",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      {!isMe && otherUser && (
        <Avatar className="w-8 h-8 mt-1">
          <AvatarImage src={otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`} />
          <AvatarFallback>{otherUser.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("flex items-start gap-1", isMe && "flex-row-reverse")}>
        {/* Message Content */}
        <div className="flex flex-col gap-1">
          {isEditing ? (
            <div className={cn(
              "flex items-center gap-2 bg-secondary rounded-3xl px-3 py-1 border-2 border-primary",
              isRTL && "flex-row-reverse"
            )}>
              <Input
                ref={inputRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "border-none bg-transparent text-sm h-8 focus-visible:ring-0 px-2",
                  isRTL && "text-right"
                )}
                disabled={updateMessageMutation.isPending}
              />
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 hover:bg-primary/20"
                  onClick={handleSaveEdit}
                  disabled={updateMessageMutation.isPending}
                >
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 hover:bg-destructive/20"
                  onClick={handleCancelEdit}
                  disabled={updateMessageMutation.isPending}
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "rounded-3xl px-4 py-2 text-sm shadow-sm relative",
              isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            )}>
              <p className={cn(isRTL && "text-right")}>{message.content}</p>
              
              {/* Edited Indicator */}
              {message.is_edited && (
                <span 
                  className="text-xs opacity-70 mt-1 block"
                  title={message.edited_at ? 
                    formatDistanceToNow(new Date(message.edited_at), { 
                      addSuffix: true,
                      locale: isRTL ? ar : undefined 
                    }) : ''
                  }
                >
                  • {isRTL ? "محررة" : "edited"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Context Menu (only for own messages) */}
        {isMe && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-accent"
                )}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-48">
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                {isRTL ? "تعديل" : "Edit"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                {isRTL ? "حذف" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? "حذف الرسالة" : "Delete Message"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? "هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this message? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isRTL && "flex-row-reverse")}>
            <AlertDialogCancel>
              {isRTL ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMessageMutation.isPending}
            >
              {deleteMessageMutation.isPending 
                ? (isRTL ? "جاري الحذف..." : "Deleting...") 
                : (isRTL ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
