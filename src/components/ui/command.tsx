"use client";

import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Command({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className
      )}
      data-slot="command"
      {...properties}
    />
  );
}

function CommandDialog({
  children,
  className,
  description = "Search for a command to run...",
  showCloseButton = true,
  title = "Command Palette",
  ...properties
}: React.ComponentProps<typeof Dialog> & {
  className?: string;
  description?: string;
  showCloseButton?: boolean;
  title?: string;
}) {
  return (
    <Dialog {...properties}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command
          className={`
          **:data-[slot=command-input-wrapper]:h-12
          [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium
          [&_[cmdk-group-heading]]:text-muted-foreground
          [&_[cmdk-group]]:px-2
          [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0
          [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5
          [&_[cmdk-input]]:h-12
          [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3
          [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5
        `}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandEmpty({
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="py-6 text-center text-sm"
      data-slot="command-empty"
      {...properties}
    />
  );
}

function CommandGroup({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        `
          overflow-hidden p-1 text-foreground
          [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5
          [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium
          [&_[cmdk-group-heading]]:text-muted-foreground
        `,
        className
      )}
      data-slot="command-group"
      {...properties}
    />
  );
}

function CommandInput({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      className="flex h-9 items-center gap-2 border-b px-3"
      data-slot="command-input-wrapper"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        className={cn(
          `
            flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden
            placeholder:text-muted-foreground
            disabled:cursor-not-allowed disabled:opacity-50
          `,
          className
        )}
        data-slot="command-input"
        {...properties}
      />
    </div>
  );
}

function CommandItem({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        `
          relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm
          outline-hidden select-none
          data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50
          data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground
          [&_svg]:pointer-events-none [&_svg]:shrink-0
          [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground
        `,
        className
      )}
      data-slot="command-item"
      {...properties}
    />
  );
}

function CommandList({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className
      )}
      data-slot="command-list"
      {...properties}
    />
  );
}

function CommandSeparator({
  className,
  ...properties
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1 h-px bg-border", className)}
      data-slot="command-separator"
      {...properties}
    />
  );
}

function CommandShortcut({
  className,
  ...properties
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      data-slot="command-shortcut"
      {...properties}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
