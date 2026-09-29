"use server";
import { revalidatePath } from "next/cache";
import { collectNews, setNewsSource } from "@/lib/news/repository";
import { NewsError, type NewsActionState } from "@/lib/news/model";
export async function newsAction(_previous:NewsActionState,form:FormData):Promise<NewsActionState>{
  try{
    const operation=form.get("operation");
    if(operation!=="source"&&operation!=="collect")throw new NewsError("Unknown news action.");
    const result=operation==="collect"?await collectNews():{status:"success" as const,message:await setNewsSource(form)};
    revalidatePath("/settings/news");revalidatePath("/briefing");return result;
  }catch(error){return {status:"error",message:error instanceof NewsError?error.message:"News could not be updated. Retry after checking your connection."};}
}
