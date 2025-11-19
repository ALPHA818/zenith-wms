import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, userFormSchema, UserFormSchemaData, ALL_PERMISSIONS } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
interface UserFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormSchemaData) => Promise<void>;
  user: User | null;
}
const formatPermissionName = (permission: string) => {
  return permission.replace(/^(manage:|view:)/, '');
};
export function UserFormSheet({ isOpen, onClose, onSubmit, user }: UserFormSheetProps) {
  const isEditing = !!user;
  const form = useForm<UserFormSchemaData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      id: "",
      name: "",
      email: "",
      permissions: [],
    },
  });
  useEffect(() => {
    if (isOpen) {
      if (user) {
        form.reset(user);
      } else {
        form.reset({
          id: `usr-${Date.now().toString().slice(-4)}`,
          name: "",
          email: "",
          permissions: [],
        });
      }
    }
  }, [user, form, isOpen]);
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit User" : "Create New User"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update the details of the existing user." : "Fill in the details for the new user."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField control={form.control} name="id" render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl><Input placeholder="e.g., usr-002" {...field} disabled={isEditing} /></FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Permissions</FormLabel>
                  </div>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map((permission) => (
                      <FormField
                        key={permission}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={permission}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(permission)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), permission])
                                      : field.onChange(
                                          (field.value || []).filter(
                                            (value) => value !== permission
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal capitalize">
                                {formatPermissionName(permission)}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="pt-4">
              <SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create User"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}