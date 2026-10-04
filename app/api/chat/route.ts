import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { findRules } from '@/lib/rules';

const system=`أنت Sailing AI، مساعد متخصص في قوانين سباقات الشراع. استخدم إطار Racing Rules of Sailing 2025-2028 الصادر عن World Sailing. لا تدّع أنك حكم أو لجنة احتجاج. عند سؤال عن قاعدة ابدأ برقم القاعدة وموضوعها، ثم اذكر القواعد المرتبطة وشروط التطبيق. عند تحليل موقف: افصل الوقائع عن الاستنتاج، حلّل الأحداث زمنياً خطوة بخطوة، اذكر أرقام القواعد في كل خطوة، ثم وضّح من له حق الطريق والقيود والاستثناءات وما المعلومات الناقصة. لا تنسخ نص القواعد كاملة؛ اشرحها بالعربية باختصار. أجب باللغة المطلوبة من المستخدم.`;

function fallback(q:string){
 const hits=findRules(q);
 if(hits.length)return hits.map(r=>`القاعدة ${r.number} — ${r.topic}\\n\\nهذه قاعدة محتملة في موقفك. اذكر الملبس، التداخل، اتجاه الريح، موقع القارب بالنسبة للعلامة أو العائق، وأي تغيير في المسار لأحدد التطبيق.`).join('\\n\\n');
 return `لتحليل الموقف بدقة أحتاج إلى:\\n1) ملبس كل قارب.\\n2) وجود التداخل من عدمه.\\n3) اتجاه الريح والمسارات.\\n4) وجود علامة أو عائق والمنطقة.\\n5) أي تغيير في المسار أو احتكاك.\\n\\nبعدها أربط الوقائع بالقواعد المناسبة.`;
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  const messages=Array.isArray(body.messages)?body.messages:[];
  const q=String(messages.at(-1)?.content||'');
  const language=String(body.language||'ar');
  const imageData=typeof body.imageData==='string'?body.imageData:'';
  const model=process.env.SAILING_AI_MODEL||'openai/gpt-6.1-sol';
  const recent=messages.slice(-12).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')}));
  if(!imageData){
   const result=await generateText({model,messages:[{role:'system',content:system},{role:'user',content:`اللغة المطلوبة: ${language}\\n\\n`+recent.map((m:any)=>m.content).join('\\n')} ]});
   return NextResponse.json({answer:result.text||fallback(q),mode:'ai',model});
  }
  const result=await generateText({model,messages:[{role:'system',content:system},{role:'user',content:[{type:'text',text:`اللغة المطلوبة: ${language}\\nحلّل هذه الصورة باعتبارها موقفاً في سباق شراع، واذكر القواعد ذات الصلة.\\n\\n${q}`},{type:'image',image:imageData}]}]});
  return NextResponse.json({answer:result.text||fallback(q),mode:'ai',model});
 }catch(error){
  console.error('Sailing AI request failed',error);
  const bodyMessage='تعذر الاتصال بمحرك الذكاء الاصطناعي حالياً. حاول مرة أخرى.';
  return NextResponse.json({answer:bodyMessage,mode:'error'},{status:503});
 }
}
