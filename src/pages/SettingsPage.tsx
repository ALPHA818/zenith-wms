import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2, List } from "lucide-react";
import { User, UserFormData, WarehouseSettings } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormSheet } from "@/components/wms/UserFormSheet";
import { PalletListDialog } from "@/components/wms/PalletListDialog";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
const formatPermissionName = (permission: string) => {
  return permission.replace(/^(manage:|view:)/, '');
};
export function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<WarehouseSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(() => {
    const stored = localStorage.getItem('autoLogoutEnabled');
    return stored === 'true';
  });
  const [palletListOpen, setPalletListOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
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
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const data = await api<WarehouseSettings>('/api/settings');
      setSettings(data);
    } catch (error) {
      toast.error("Failed to fetch settings.");
      console.error(error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, [fetchUsers, fetchSettings]);
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

  const handleAutoLogoutToggle = (enabled: boolean) => {
    setAutoLogoutEnabled(enabled);
    localStorage.setItem('autoLogoutEnabled', String(enabled));
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('localStorageUpdate'));
    toast.success(`Auto-logout ${enabled ? 'enabled' : 'disabled'} successfully.`);
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
                {canManage && user.password && <p className="text-sm font-mono mt-1">Password: {showPasswords ? user.password : '••••••••'}</p>}
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
              <TableHead>Name</TableHead><TableHead>Email</TableHead>{canManage && <TableHead>Password</TableHead>}<TableHead>Permissions</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell><TableCell>{user.email}</TableCell>
                {canManage && <TableCell><span className="font-mono text-sm">{showPasswords ? (user.password || '••••••••') : '••••••••'}</span></TableCell>}
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
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Configuration</CardTitle>
              <CardDescription>Set the number of warehouses and pallet locations per warehouse.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-3xl">
              {settingsLoading && !settings ? (
                <>
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </>
              ) : settings ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="warehouseCount">Warehouses</Label>
                    <input
                      id="warehouseCount"
                      type="number"
                      min={1}
                      max={100}
                      className="border rounded-md h-9 px-3 w-full bg-background max-w-xs"
                      value={settings.warehouses.length}
                      onChange={(e) => {
                        const count = Math.max(1, Math.min(100, parseInt(e.target.value || '1', 10)));
                        setSettings((s) => {
                          if (!s) return s;
                          const cur = [...s.warehouses];
                          if (count > cur.length) {
                            const add = Array.from({ length: count - cur.length }, (_, idx) => {
                              const n = cur.length + idx + 1;
                              return { id: `w${n}`, name: `Warehouse ${n}`, palletLocations: 100 };
                            });
                            return { warehouses: [...cur, ...add] };
                          }
                          return { warehouses: cur.slice(0, count) };
                        });
                      }}
                    />
                    <p className="text-sm text-muted-foreground">Adjust the number of warehouses. New warehouses default to 100 pallet locations.</p>
                  </div>

                  <div className="space-y-4">
                    <Label>Per-warehouse pallet locations</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {settings.warehouses.map((w, idx) => (
                        <div key={w.id} className="flex items-center gap-3">
                          <div className="w-40 text-sm font-medium">{w.name || `Warehouse ${idx + 1}`}</div>
                          <input
                            type="number"
                            min={1}
                            max={10000}
                            className="border rounded-md h-9 px-3 w-full bg-background"
                            value={w.palletLocations}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(10000, parseInt(e.target.value || '1', 10)));
                              setSettings((s) => {
                                if (!s) return s;
                                const next = s.warehouses.map((ww, i) => (i === idx ? { ...ww, palletLocations: val } : ww));
                                return { warehouses: next };
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Button onClick={() => setConfirmSaveOpen(true)}>Save Settings</Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and authentication options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-logout" className="text-base cursor-pointer">
                    Auto-logout on inactivity
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out users after 10 minutes of inactivity
                  </p>
                </div>
                <Switch
                  id="auto-logout"
                  checked={autoLogoutEnabled}
                  onCheckedChange={handleAutoLogoutToggle}
                />
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Pallet Management</CardTitle>
            <CardDescription>View and manage all warehouse pallets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Pallet List</Label>
                <p className="text-sm text-muted-foreground">
                  View all pallets with their details, locations, and expiry information
                </p>
              </div>
              <Button onClick={() => setPalletListOpen(true)}>
                <List className="mr-2 h-4 w-4" />
                View All Pallets
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Add, remove, or edit user permissions.</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {canManage && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-passwords"
                    checked={showPasswords}
                    onCheckedChange={setShowPasswords}
                  />
                  <Label htmlFor="show-passwords" className="cursor-pointer">Show Passwords</Label>
                </div>
              )}
              {canManage && (
                <Button onClick={handleAddUser}><PlusCircle className="mr-2 h-4 w-4" />Add User</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {renderUserContent()}
          </CardContent>
        </Card>
      </div>
      {canManage && (
        <UserFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} user={selectedUser} />
      )}
      
      <PalletListDialog isOpen={palletListOpen} onClose={() => setPalletListOpen(false)} />
      
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
      {/* Confirm changing settings */}
      <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to change these settings?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing warehouse counts or pallet locations can impact operations. This action will update the configuration immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!settings) return;
                try {
                  await api<WarehouseSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
                  toast.success('Settings saved');
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to save settings');
                } finally {
                  setConfirmSaveOpen(false);
                }
              }}
            >
              Yes, save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors />
    </AppLayout>
  );
}