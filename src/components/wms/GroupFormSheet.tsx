import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import type { Group, User, GroupFormData } from '@shared/types';
import { groupSchema } from '@shared/types';

interface GroupFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  users: User[];
  onSave: () => void;
}

export const GroupFormSheet: React.FC<GroupFormSheetProps> = ({
  open,
  onOpenChange,
  group,
  users,
  onSave,
}) => {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    memberIds: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        memberIds: group.memberIds,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        memberIds: [],
      });
    }
    setErrors({});
  }, [group, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validation = groupSchema.safeParse({
        ...formData,
        createdBy: user?.id,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsSubmitting(false);
        return;
      }

      if (group) {
        await api(`/api/wms/groups/${group.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        const memberIds = user?.id
          ? Array.from(new Set([user.id, ...formData.memberIds]))
          : formData.memberIds;
        await api('/api/wms/groups', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            memberIds,
            createdBy: user?.id,
          }),
        });
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save group:', error);
      setErrors({ submit: 'Failed to save group. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMemberToggle = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter((id) => id !== userId)
        : [...prev.memberIds, userId],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>{group ? 'Edit Group' : 'Add Group'}</SheetTitle>
          <SheetDescription>
            {group
              ? 'Update group details and manage members.'
              : 'Create a new chat group and add members.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Engineering Team"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description for the group"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Members ({formData.memberIds.length} selected)</Label>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-4">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No users available
                  </p>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${u.id}`}
                        checked={formData.memberIds.includes(u.id)}
                        onCheckedChange={() => handleMemberToggle(u.id)}
                      />
                      <Label
                        htmlFor={`user-${u.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{u.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {u.email}
                        </div>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {errors.submit && (
            <p className="text-sm text-destructive">{errors.submit}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : group ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
