"use server";
import { revalidatePath } from "next/cache";
import { changeReview } from "@/lib/spending/repository";
import { SpendingError, type SpendingState } from "@/lib/spending/model";
export async function reviewAction(_state: SpendingState, form: FormData): Promise<SpendingState> {
  try {
    const message = await changeReview(form);
    revalidatePath("/spending/review");
    return { status: "success", message };
  } catch (error) {
    return { status: "error", message: error instanceof SpendingError ? error.message : "Review could not be updated. Please retry." };
  }
}
