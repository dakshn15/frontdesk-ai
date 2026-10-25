"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  CheckboxField,
  Field,
  SelectField,
  TextareaField,
} from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { saveStaffProfile } from "@/features/staff/actions";
import type { StaffDetail } from "@/features/staff/queries";

export function ProfileForm({
  slug,
  profile,
  members,
}: {
  slug: string;
  profile: StaffDetail["profile"];
  members: StaffDetail["linkableMembers"];
}) {
  const { state, onSubmit, pending, fieldErrors, formError } = useActionForm(
    saveStaffProfile.bind(null, slug),
  );

  useEffect(() => {
    if (state?.ok) toast.success("Saved.");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <input type="hidden" name="staffId" value={profile.id} />
      <Field
        label="Name"
        name="name"
        defaultValue={profile.name}
        required
        errors={fieldErrors?.name}
      />
      <Field
        label="Job title (optional)"
        name="title"
        placeholder="Senior stylist"
        defaultValue={profile.title}
        errors={fieldErrors?.title}
      />
      <TextareaField
        label="Bio (optional)"
        name="bio"
        rows={3}
        defaultValue={profile.bio}
        errors={fieldErrors?.bio}
      />
      <SelectField
        label="Team login (optional)"
        name="userId"
        defaultValue={profile.userId ?? ""}
        hint="Link a team member so this profile is theirs."
        errors={fieldErrors?.userId}
      >
        <option value="">Not linked</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </SelectField>
      <CheckboxField
        label="Can be booked"
        name="active"
        defaultChecked={profile.active}
      />
      <Button type="submit" className="mt-2 h-10 w-fit px-4" disabled={pending}>
        Save profile
      </Button>
    </form>
  );
}
