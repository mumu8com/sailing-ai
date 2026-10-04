import { generateText } from 'ai';

const instructions='You are a test endpoint for Sailing AI. Answer briefly in Arabic.';

export async function GET(){
  const started=Date.now();
  try{
    const text=await generateText({
      model:process.env.SAILING_AI_MODEL||'openai/gpt-6.1-sol',
      instructions,
      prompt:'اختبار اتصال: ما هي القاعدة 10 في قوانين سباقات الشراع؟ اذكر رقم القاعدة وموضوعها باختصار.'
    });
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const image=await generateText({
      model:process.env.SAILING_AI_MODEL||'openai/gpt-6.1-sol',
      instructions,
      messages:[{role:'user',content:[
        {type:'text',text:'اختبار الصورة: صف الصورة في جملة قصيرة.'},
        {type:'image',image:png}
      ]}]
    });
    return Response.json({ok:true,elapsedMs:Date.now()-started,text:text.text,image:image.text});
  }catch(error){
    console.error('Sailing AI self-test failed',error);
    return Response.json({ok:false,error:String(error),elapsedMs:Date.now()-started},{status:500});
  }
}