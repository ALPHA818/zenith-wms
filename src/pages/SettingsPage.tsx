import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { User, UserFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormSheet } from "@/components/wms/UserFormSheet";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
const formatPermissionName = (permission: string) => {
  return permission.replace(/^(manage:|view:)/, '');
};
export function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const authUser = useAuthStore((state) => state.user);
  const canManage = authUser?.permissions?.includes('manage:users') ?? false;
  const isMobile = useIsMobile();
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<User[]>('/api/wms/users');
      setUsers(data);
    } catch (error) {
      toast.error("Failed to fetch users.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  const handleAddUser = () => { setSelectedUser(null); setIsSheetOpen(true); };
  const handleEditUser = (user: User) => { setSelectedUser(user); setIsSheetOpen(true); };
  const handleDeleteClick = (user: User) => { setUserToDelete(user); setIsDeleteDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await api(`/api/wms/users/${userToDelete.id}`, { method: 'DELETE' });
      toast.success(`User "${userToDelete.name}" deleted successfully.`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };
  const handleFormSubmit = async (data: UserFormData) => {
    try {
      const method = selectedUser ? 'PUT' : 'POST';
      const url = selectedUser ? `/api/wms/users/${selectedUser.id}` : '/api/wms/users';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`User "${data.name}" ${selectedUser ? 'updated' : 'created'} successfully.`);
      setIsSheetOpen(false);
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save user: ${errorMessage}`);
      console.error(error);
    }
  };
  const renderActions = (user: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === authUser?.id}>
          <span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditUser(user)} disabled={user.id === authUser?.id}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-destructive focus:text-destructive" disabled={user.id === authUser?.id}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const renderUserContent = () => {
    if (loading) {
      return isMobile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader><TableRow>{Array.from({ length: canManage ? 4 : 3 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}</TableRow></TableHeader>
            <TableBody>{Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: canManage ? 4 : 3 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>))}</TableBody>
          </Table>
        </div>
      );
    }
    if (users.length === 0) {
      return <div className="text-center py-12">No users found.</div>;
    }
    return isMobile ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {users.map(user => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              {canManage && renderActions(user)}
            </CardHeader>
            <CardContent>
              <h4 className="text-sm font-semibold mb-2">Permissions</h4>
              <div className="flex flex-wrap gap-1">
                {(user.permissions || []).length > 0 ? (
                  (user.permissions || []).map(p => <Badge key={p} variant="outline" className="capitalize">{formatPermissionName(p)}</Badge>)
                ) : (
                  <span className="text-xs text-muted-foreground">No specific permissions</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Permissions</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell><TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(user.permissions || []).length > 0 ? (
                      (user.permissions || []).map(p => <Badge key={p} variant="outline" className="capitalize">{formatPermissionName(p)}</Badge>)
                    ) : (
                      <span className="text-xs text-muted-foreground">No specific permissions</span>
                    )}
                  </div>
                </TableCell>
                {canManage && <TableCell className="text-right">{renderActions(user)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  return (
    <AppLayout container>
      <PageHeader title="Settings" subtitle="Manage your warehouse and user configurations." />
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Add, remove, or edit user permissions.</CardDescription>
            </div>
            {canManage && (
              <Button onClick={handleAddUser}><PlusCircle className="mr-2 h-4 w-4" />Add User</Button>
            )}
          </CardHeader>
          <CardContent>
            {renderUserContent()}
          </CardContent>
        </Card>
      </div>
      {canManage && (
        <UserFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} user={selectedUser} />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the user "{userToDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors />
    </AppLayout>
  );
}