"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Dialog({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...properties} />;
}

function DialogClose({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...properties} />;
}

function DialogContent({
  children,
  className,
  showCloseButton = true,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          `
            data-[state=open]:animate-in
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:zoom-in-95
            fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%]
            translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200
            sm:max-w-lg
          `,
          className
        )}
        data-slot="dialog-content"
        {...properties}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className={`
              absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity
              hover:opacity-100
              focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden
              disabled:pointer-events-none
              data-[state=open]:bg-accent data-[state=open]:text-muted-foreground
              [&_svg]:pointer-events-none [&_svg]:shrink-0
              [&_svg:not([class*='size-'])]:size-4
            `}
            data-slot="dialog-close"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogDescription({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="dialog-description"
      {...properties}
    />
  );
}

function DialogFooter({
  className,
  ...properties
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        `
          flex flex-col-reverse gap-2
          sm:flex-row sm:justify-end
        `,
        className
      )}
      data-slot="dialog-footer"
      {...properties}
    />
  );
}

function DialogHeader({
  className,
  ...properties
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        `
          flex flex-col gap-2 text-center
          sm:text-left
        `,
        className
      )}
      data-slot="dialog-header"
      {...properties}
    />
  );
}

function DialogOverlay({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        `
          data-[state=open]:animate-in
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
          data-[state=open]:fade-in-0
          fixed inset-0 z-50 bg-black/50
        `,
        className
      )}
      data-slot="dialog-overlay"
      {...properties}
    />
  );
}

function DialogPortal({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...properties} />;
}

function DialogTitle({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg leading-none font-semibold", className)}
      data-slot="dialog-title"
      {...properties}
    />
  );
}

function DialogTrigger({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...properties} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
