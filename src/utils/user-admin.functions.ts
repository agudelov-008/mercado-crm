import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/utils/supabaseAdmin";

const deleteUserAccountInput = z.object({
  userId: z.string().uuid(),
});

export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator(deleteUserAccountInput)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true as const };
  });

const updateUserAccountAdminInput = z
  .object({
    userId: z.string().uuid(),
    newEmail: z.string().email().optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((payload) => payload.newEmail !== undefined || payload.newPassword !== undefined, {
    message: "Debe indicarse newEmail y/o newPassword.",
  });

export const updateUserAccountAdmin = createServerFn({ method: "POST" })
  .inputValidator(updateUserAccountAdminInput)
  .handler(async ({ data }) => {
    const authUpdates: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
    } = {};

    if (data.newEmail !== undefined) {
      authUpdates.email = data.newEmail;
      authUpdates.email_confirm = true;
    }

    if (data.newPassword !== undefined) {
      authUpdates.password = data.newPassword;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      authUpdates,
    );

    if (error) {
      throw new Error(error.message);
    }

    return { success: true as const };
  });
