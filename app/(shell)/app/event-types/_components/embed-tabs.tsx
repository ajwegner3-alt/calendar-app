"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  buildScriptSnippet,
  buildIframeSnippet,
} from "../_lib/embed-snippets";

interface EmbedTabsProps {
  appUrl: string;
  accountSlug: string;
  eventSlug: string;
}

export function EmbedTabs({ appUrl, accountSlug, eventSlug }: EmbedTabsProps) {
  const opts = { appUrl, accountSlug, eventSlug };
  const scriptSnippet = buildScriptSnippet(opts);
  const iframeSnippet = buildIframeSnippet(opts);

  return (
    <Tabs defaultValue="script" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="script">Script (recommended)</TabsTrigger>
        <TabsTrigger value="iframe">iframe fallback</TabsTrigger>
      </TabsList>
      <TabsContent value="script" className="mt-4">
        <SnippetBlock snippet={scriptSnippet} kind="script" />
      </TabsContent>
      <TabsContent value="iframe" className="mt-4">
        <SnippetBlock snippet={iframeSnippet} kind="iframe" />
      </TabsContent>
    </Tabs>
  );
}

function SnippetBlock({
  snippet,
  kind,
}: {
  snippet: string;
  kind: "script" | "iframe";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success(
        kind === "script" ? "Script snippet copied" : "iframe snippet copied",
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail without HTTPS or without permissions —
      // fall back to the legacy execCommand approach
      try {
        const textarea = document.createElement("textarea");
        textarea.value = snippet;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        toast.success(
          kind === "script" ? "Script snippet copied" : "iframe snippet copied",
        );
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Copy failed — select the text manually");
      }
    }
  };

  return (
    <div className="space-y-2">
      <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
        {snippet}
      </pre>
      <Button
        type="button"
        variant={copied ? "secondary" : "default"}
        onClick={handleCopy}
        className="w-full sm:w-auto"
      >
        {copied ? "Copied!" : "Copy snippet"}
      </Button>
    </div>
  );
}
