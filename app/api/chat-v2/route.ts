import { NextResponse } from "next/server";
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
  const token = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  return createClient(url, key, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
}

async function openai(path: string, body: unknown) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${detail.slice(0, 500)}`);
  }
  return res.json();
}

async function getEmbedding(input: string) {
  const data = await openai("embeddings", { model: "text-embedding-3-small", input });
  return data.data?.[0]?.embedding as number[] | undefined;
}

function extractAnswer(data: any) {
  return data.output_text ||
    data.output?.flatMap((x: any) => x.content || []).find((x: any) => x.type === "output_text")?.text ||
    "";
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
        const embedding = await getEmbedding(question);
        if (embedding) {
          const { data } = await supabase.rpc("match_rule_chunks", {
            query_embedding: embedding,
            match_threshold: 0.30,
            match_count: 8,
          });
          sources = (data || []).map((x: any) => ({
            id: x.id, ruleId: x.rule_id, documentId: x.document_id,
            ruleNumber: x.metadata?.rule_number || null, title: x.heading || null,
            page: x.page_number || null, content: x.content,
            source: x.metadata?.source || null, similarity: x.similarity,
          }));
        }
      } catch (e) {
        console.error("RAG retrieval failed", e);
      }
    }

    const localHits = findRules(question);
    const context = sources.length
      ? sources.map((s, i) => `[مصدر ${i + 1}] القاعدة ${s.ruleNumber || "غير محددة"} | ${s.title || "بدون عنوان"} | الصفحة ${s.page || "غير محددة"} | ${s.source || "وثيقة القواعد"}\\n${s.content}`).join("\\n\\n")
      : "لا توجد مصادر مسترجعة من قاعدة المعرفة لهذا السؤال.";

    const recent = messages.slice(-12).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    }));

    const model = process.env.SAILING_AI_MODEL || "gpt-5.6";
    const instruction = `${SYSTEM}\\n\\nسياق قاعدة المعرفة:\\n${context}\\n\\nإذا لم توجد مصادر، لا تقدم رقماً جديداً للقاعدة اعتماداً على الذاكرة فقط.\\nاللغة المطلوبة: ${language}`;

    const input = imageData
      ? [{
          role: "user",
          content: [
            { type: "input_text", text: `اللغة: ${language}\\nالوضع: ${mode}\\nالسؤال: ${question}\\n\\nسياق القواعد:\\n${context}` },
            { type: "input_image", image_url: `data:${imageMime};base64,${imageData}` },
          ],
        }]
      : recent;

    const result = await openai("responses", {
      model,
      instructions: instruction,
      input,
      max_output_tokens: 1600,
    });
    let answer = extractAnswer(result);

    if (!answer && localHits.length) answer = localHits.map(r => `القاعدة ${r.number} — ${r.topic}: تحتاج تفاصيل الموقف لتحديد التطبيق.`).join("\\n");

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

    return NextResponse.json({ answer: answer || "المعلومات المتاحة غير كافية.", sources, conversationId, mode: "direct-openai", model });
  } catch (error) {
    console.error("SailRace AI request failed", error);
    return NextResponse.json({ answer: "تعذر تشغيل المساعد حالياً. تحقق من إعداد مفتاح الذكاء الاصطناعي ثم حاول مرة أخرى.", sources: [] }, { status: 503 });
  }
}