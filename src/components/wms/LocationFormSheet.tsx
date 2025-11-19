import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Location, locationSchema, LocationFormData } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
interface LocationFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LocationFormData) => Promise<void>;
  location: Location | null;
}
export function LocationFormSheet({ isOpen, onClose, onSubmit, location }: LocationFormSheetProps) {
  const isEditing = !!location;
  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      id: "",
      name: "",
      type: "Aisle",
      description: "",
    },
  });
  useEffect(() => {
    if (isOpen) {
      if (location) {
        form.reset(location);
      } else {
        // Generate a random ID matching the new format
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const randomChar1 = chars[Math.floor(Math.random() * chars.length)];
        const randomDigits = Math.floor(10 + Math.random() * 90).toString(); // 10-99
        const randomChar2 = chars[Math.floor(Math.random() * chars.length)];
        const newId = `${randomChar1}${randomDigits}${randomChar2}`;
        form.reset({
          id: newId,
          name: "",
          type: "Aisle",
          description: "",
        });
      }
    }
  }, [location, form, isOpen]);
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Location" : "Create New Location"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update the details of the existing location." : "Fill in the details for the new location."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., A01S" {...field} disabled={isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Aisle 1, Shelf A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Aisle">Aisle</SelectItem>
                      <SelectItem value="Shelf">Shelf</SelectItem>
                      <SelectItem value="Bin">Bin</SelectItem>
                      <SelectItem value="Zone">Zone</SelectItem>
                      <SelectItem value="Dock">Dock</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Main receiving area for large items." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SheetFooter className="pt-4">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Location"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}