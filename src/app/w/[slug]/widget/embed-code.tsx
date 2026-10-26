"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The script tag to paste into the business's website, with a copy button. */
export function EmbedCode({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it instead.");
    }
  }

  return (
    <div className="grid max-w-xl gap-3">
      <Textarea
        readOnly
        value={code}
        rows={3}
        aria-label="Embed code"
        className="font-mono text-xs"
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button type="button" className="h-9 w-fit px-3" onClick={copy}>
        <Copy />
        Copy code
      </Button>
    </div>
  );
}
