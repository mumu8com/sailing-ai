import { NextResponse } from "next/server";
import { generateText, embed } from "ai";
import { createClient } from "@supabase/supabase-js";
import { findRules } from "@/lib/rules";

const SYSTEM = `أنت SailRace AI، مساعد متخصص في قوانين سباقات الشراع.
استخدم فقط المصادر المسترجعة من قاعدة المعرفة عند الإجابة القانونية. لا تخترع قاعدة أو رقم قاعدة أو مصدراً.
إذا لم تكن المصادر كافية، صرّح بذلك بوضوح وحدد المعلومات المطلوبة.
عند وجود مصدر، اذكر رقم القاعدة والعنوان والمصدر والصفحة إن توفرت.
حلّل الموقف زمنياً: الوقائع، القاعدة، حق الطريق، القيود والاستثناءات، ثم النتيجة.
لا تنسخ نص القواعد كاملاً؛ اشرحها بالعربية باختصار.
هذا مساعد تعليمي وليس بديلاً عن قرار الحكم أو لجنة الاحتجاج.`;

function getClient(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return createClient(url, key, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const question = String(messages.at(-1)?.content || "").trim();
    if (!question) return NextResponse.json({ answer: "اكتب سؤالك أولاً.", sources: [] }, { status: 400 });

    const language = String(body.language || "ar");
    const mode = String(body.mode || "rules");
    const imageData = typeof body.imageData === "string" ? body.imageData : "";
    const imageMime = typeof body.imageMime === "string" && body.imageMime.startsWith("image/") ? body.imageMime : "image/jpeg";
    const supabase = getClient(req);
    let userId: string | null = null;
    let conversationId: string | null = typeof body.conversationId === "string" ? body.conversationId : null;
    let sources: any[] = [];

    if (supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id || null;
    }

    if (!imageData && supabase && userId) {
      try {
        const { embedding } = await embed({ model: "openai/text-embedding-3-small", value: question });
        const { data } = await supabase.rpc("match_rule_chunks", {
          query_embedding: embedding,
          match_threshold: 0.30,
          match_count: 8,
        });
        sources = (data || []).map((x: any) => ({
          id: x.id,
          ruleId: x.rule_id,
          documentId: x.document_id,
          ruleNumber: x.metadata?.rule_number || null,
          title: x.heading || null,
          page: x.page_number || null,
          content: x.content,
          source: x.metadata?.source || null,
          similarity: x.similarity,
        }));
      } catch (e) {
        console.error("RAG retrieval failed", e);
      }
    }

    const localHits = findRules(question);
    const context = sources.length
      ? sources.map((s, i) => `[مصدر ${i + 1}] القاعدة ${s.ruleNumber || "غير محددة"} | ${s.title || "بدون عنوان"} | الصفحة ${s.page || "غير محددة"} | ${s.source || "وثيقة القواعد"}\n${s.content}`).join("\n\n")
      : "لا توجد مصادر مسترجعة من قاعدة المعرفة لهذا السؤال.";

    const recent = messages.slice(-12).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    }));

    const model = process.env.SAILING_AI_MODEL || "openai/gpt-5.6-sol";
    let answer = "";

    if (imageData) {
      const result = await generateText({
        model,
        instructions: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `اللغة: ${language}\nالوضع: ${mode}\nالسؤال: ${question}\n\nسياق القواعد:\n${context}` },
            { type: "file", data: imageData, mediaType: imageMime },
          ],
        }],
        maxOutputTokens: 1600,
      });
      answer = result.text;
    } else {
      const result = await generateText({
        model,
        instructions: `${SYSTEM}\n\nسياق قاعدة المعرفة:\n${context}\n\nإذا لم توجد مصادر، لا تقدم رقماً جديداً للقاعدة اعتماداً على الذاكرة فقط.\nاللغة المطلوبة: ${language}`,
        messages: recent,
        maxOutputTokens: 1600,
      });
      answer = result.text;
    }

    if (!answer && localHits.length) answer = localHits.map(r => `القاعدة ${r.number} — ${r.topic}: تحتاج تفاصيل الموقف لتحديد التطبيق.`).join("\n");

    if (supabase && userId) {
      if (!conversationId) {
        const { data } = await supabase.from("ai_conversations").insert({ user_id: userId, title: question.slice(0, 80) }).select("id").single();
        conversationId = data?.id || null;
      }
      if (conversationId) {
        await supabase.from("ai_messages").insert([
          { conversation_id: conversationId, user_id: userId, role: "user", content: question },
          { conversation_id: conversationId, user_id: userId, role: "assistant", content: answer || "لم يتم توليد إجابة.", sources },
        ]);
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
      }
    }

    return NextResponse.json({ answer: answer || "المعلومات المتاحة غير كافية.", sources, conversationId, mode: "rag-ai", model });
  } catch (error) {
    console.error("SailRace AI request failed", error);
    return NextResponse.json({ answer: "تعذر تشغيل المساعد حالياً. حاول مرة أخرى.", sources: [] }, { status: 503 });
  }
}